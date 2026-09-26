"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { formatDate, fullName } from "@/lib/format";
import type { CycleDetail, Department, KpiTemplate } from "@/lib/types";
import { Alert, Badge, Button, Card, EmptyState, Field, PageHeader, Select, Spinner, Stat, Table, Td, Th } from "@/components/ui";
import { PersonAvatar } from "@/components/photo";
import { STAGE_LABEL, ScoreText, StageBadge } from "@/components/performance";

export default function CyclePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const cycle = useApi<CycleDetail>(`/performance/cycles/${id}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (cycle.loading && !cycle.data) return <Spinner />;
  if (cycle.error) return <Alert>{cycle.error}</Alert>;
  const c = cycle.data;
  if (!c) return null;

  async function act(name: string, fn: () => Promise<unknown>) {
    setBusy(name);
    setError(null);
    try {
      await fn();
      await cycle.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Link href="/performance" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="size-4" /> Performance
      </Link>
      <PageHeader
        title={c.name}
        description={`${formatDate(c.periodStart)} – ${formatDate(c.periodEnd)}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={c.status === "ACTIVE" ? "green" : c.status === "DRAFT" ? "gray" : "blue"}>
              {c.status === "DRAFT" ? "Not started" : c.status === "ACTIVE" ? "In progress" : "Closed"}
            </Badge>
            {c.status === "DRAFT" && (
              <Button
                variant="secondary"
                loading={busy === "delete"}
                onClick={() => {
                  if (window.confirm("Delete this cycle?"))
                    act("delete", async () => {
                      await api("DELETE", `/performance/cycles/${id}`);
                      router.push("/performance");
                    });
                }}
              >
                Delete
              </Button>
            )}
            {c.status === "ACTIVE" && (
              <Button
                variant="secondary"
                loading={busy === "close"}
                onClick={() => {
                  if (window.confirm("Close this cycle? Reviews that aren't done can no longer be changed."))
                    act("close", () => api("POST", `/performance/cycles/${id}/close`));
                }}
              >
                Close cycle
              </Button>
            )}
          </div>
        }
      />
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="People" value={c.reviewCount} />
        {(["GOALS", "SELF", "MANAGER"] as const).map((s) => (
          <Stat key={s} label={STAGE_LABEL[s]} value={c.byStage[s] ?? 0} />
        ))}
        <Stat label="Done" value={c.doneCount} hint={c.averageScore !== null ? `Average ${c.averageScore}%` : undefined} />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        {c.status !== "CLOSED" && <Launch cycleId={id} started={c.status === "ACTIVE"} onDone={cycle.reload} />}
        <div className={c.status !== "CLOSED" ? "xl:col-span-2" : "xl:col-span-3"}>
          <Card title="Reviews" padded={false}>
            {c.reviews.length === 0 ? (
              <EmptyState title="No one in this cycle yet" description="Choose KPIs and who to include, then start the cycle." />
            ) : (
              <Table>
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Employee</Th>
                    <Th>Reviewer</Th>
                    <Th>Stage</Th>
                    <Th>Score</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {c.reviews.map((r) => (
                    <tr key={r.id}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <PersonAvatar person={r.employee} photo={r.employee.photoUpdatedAt ? { employeeId: r.employee.id, updatedAt: r.employee.photoUpdatedAt } : null} />
                          <div>
                            <p className="font-medium text-slate-900">{fullName(r.employee)}</p>
                            <p className="text-xs text-slate-500">{r.employee.designation}</p>
                          </div>
                        </div>
                      </Td>
                      <Td>{r.reviewer ? fullName(r.reviewer) : <span className="text-slate-400">HR (no manager)</span>}</Td>
                      <Td>
                        <StageBadge stage={r.stage} />
                      </Td>
                      <Td>
                        <ScoreText score={r.finalScore} band={r.band} />
                      </Td>
                      <Td className="text-right">
                        <Link href={`/performance/reviews/${r.id}`} className="text-sm font-medium text-[#00857a] hover:underline">
                          Open
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Launch({ cycleId, started, onDone }: { cycleId: string; started: boolean; onDone: () => void }) {
  const kpis = useApi<KpiTemplate[]>("/performance/kpis");
  const departments = useApi<Department[]>("/departments");
  const [chosen, setChosen] = useState<string[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const active = (kpis.data ?? []).filter((k) => k.isActive);

  async function launch() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await api<{ created: number }>("POST", `/performance/cycles/${cycleId}/launch`, {
        kpiTemplateIds: chosen,
        ...(departmentId && { departmentId }),
      });
      setMessage({
        tone: "success",
        text: res.created ? `Added ${res.created} ${res.created === 1 ? "person" : "people"}. Their managers can now set goals.` : "Everyone chosen is already in this cycle.",
      });
      onDone();
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Could not start" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={started ? "Add more people" : "Start this cycle"}>
      <div className="space-y-4">
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-slate-700">KPIs to include</legend>
          {active.length === 0 ? (
            <p className="text-sm text-slate-500">
              No KPIs yet — add some on the <Link href="/performance" className="text-[#00857a] underline">KPI list</Link> tab.
            </p>
          ) : (
            active.map((k) => (
              <label key={k.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={chosen.includes(k.id)}
                  onChange={(e) => setChosen(e.target.checked ? [...chosen, k.id] : chosen.filter((x) => x !== k.id))}
                />
                {k.name}
                <span className="text-xs text-slate-400">({k.auto ? "auto" : k.measure === "RATING" ? "1–5" : "target"}, {k.defaultWeight}%)</span>
              </label>
            ))
          )}
          <p className="text-xs text-slate-500">Weights are spread to add up to 100%. Managers can change them per person.</p>
        </fieldset>
        <Field label="Who">
          <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">Everyone in the company</option>
            {departments.data?.map((d) => (
              <option key={d.id} value={d.id}>
                Only {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button onClick={launch} loading={busy} disabled={chosen.length === 0} className="w-full">
          {started ? "Add people" : "Start cycle"}
        </Button>
      </div>
    </Card>
  );
}
