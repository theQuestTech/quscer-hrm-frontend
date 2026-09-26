"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { formatDate, fullName } from "@/lib/format";
import type { CycleSummary, KpiTemplate, ReviewListItem } from "@/lib/types";
import { Alert, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Spinner, Table, Tabs, Td, Th, Badge } from "@/components/ui";
import { CrudList } from "../settings/crud-list";
import { PersonAvatar } from "@/components/photo";
import { ScoreText, StageBadge } from "@/components/performance";

type Tab = "mine" | "team" | "cycles" | "kpis";

export default function PerformancePage() {
  const { me, can } = useAuth();
  const isHr = can("hrm.employee.write") || can("hrm.settings.write");
  const isManager = !isHr && (can("hrm.leave.approve") || can("hrm.attendance.approve"));
  const tabs: { id: Tab; label: string }[] = [
    ...(me?.employee ? [{ id: "mine" as Tab, label: "My reviews" }] : []),
    ...(isHr || isManager ? [{ id: "team" as Tab, label: isHr ? "Reviews in progress" : "My team" }] : []),
    ...(isHr ? [{ id: "cycles" as Tab, label: "Review cycles" }, { id: "kpis" as Tab, label: "KPI list" }] : []),
  ];
  const [tab, setTab] = useState<Tab>(isHr ? "cycles" : isManager ? "team" : "mine");

  if (!me?.organization.modules.includes("performance")) {
    return <Alert tone="info">Performance isn&apos;t turned on for this company. HR can turn it on in Settings.</Alert>;
  }
  return (
    <>
      <PageHeader title="Performance" description="Goals, self-reviews and manager reviews" />
      {tabs.length > 1 && <Tabs tabs={tabs} value={tab} onChange={setTab} />}
      {tab === "mine" && <ReviewList scope="mine" />}
      {tab === "team" && <ReviewList scope="team" />}
      {tab === "cycles" && <Cycles />}
      {tab === "kpis" && <KpiList />}
    </>
  );
}

function ReviewList({ scope }: { scope: "mine" | "team" }) {
  const reviews = useApi<ReviewListItem[]>(`/performance/reviews?scope=${scope}`);
  if (reviews.loading && !reviews.data) return <Spinner />;
  if (reviews.error) return <Alert>{reviews.error}</Alert>;
  if (!reviews.data?.length) {
    return (
      <Card>
        <EmptyState
          title={scope === "mine" ? "No reviews yet" : "No reviews to give right now"}
          description={scope === "mine" ? "When HR starts a review cycle, your review shows up here." : "Reviews for your team appear here when HR starts a cycle."}
        />
      </Card>
    );
  }
  return (
    <Card padded={false}>
      <Table>
        <thead className="bg-slate-50">
          <tr>
            {scope === "team" && <Th>Employee</Th>}
            <Th>Cycle</Th>
            <Th>Stage</Th>
            <Th>Score</Th>
            <Th />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {reviews.data.map((r) => (
            <tr key={r.id}>
              {scope === "team" && (
                <Td>
                  <div className="flex items-center gap-3">
                    <PersonAvatar person={r.employee} photo={r.employee.photoUpdatedAt ? { employeeId: r.employee.id, updatedAt: r.employee.photoUpdatedAt } : null} />
                    <div>
                      <p className="font-medium text-slate-900">{fullName(r.employee)}</p>
                      <p className="text-xs text-slate-500">{r.employee.designation}</p>
                    </div>
                  </div>
                </Td>
              )}
              <Td>
                <p className="font-medium text-slate-900">{r.cycle.name}</p>
                <p className="text-xs text-slate-500">
                  {formatDate(r.cycle.periodStart)} – {formatDate(r.cycle.periodEnd)}
                </p>
              </Td>
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
    </Card>
  );
}

function Cycles() {
  const router = useRouter();
  const cycles = useApi<CycleSummary[]>("/performance/cycles");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", periodStart: "", periodEnd: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const c = await api<{ id: string }>("POST", "/performance/cycles", form);
      router.push(`/performance/cycles/${c.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create");
      setSaving(false);
    }
  }

  return (
    <Card
      title="Review cycles"
      padded={false}
      actions={
        <Button size="sm" onClick={() => setOpen(true)}>
          New review cycle
        </Button>
      }
    >
      {cycles.loading && !cycles.data ? (
        <Spinner />
      ) : !cycles.data?.length ? (
        <EmptyState title="No review cycles yet" description="Start with the KPI list, then create a cycle such as “Q4 2026”." />
      ) : (
        <Table>
          <thead className="bg-slate-50">
            <tr>
              <Th>Cycle</Th>
              <Th>Status</Th>
              <Th>Progress</Th>
              <Th>Average score</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cycles.data.map((c) => (
              <tr key={c.id}>
                <Td>
                  <p className="font-medium text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(c.periodStart)} – {formatDate(c.periodEnd)}
                  </p>
                </Td>
                <Td>
                  <Badge tone={c.status === "ACTIVE" ? "green" : c.status === "DRAFT" ? "gray" : "blue"}>
                    {c.status === "DRAFT" ? "Not started" : c.status === "ACTIVE" ? "In progress" : "Closed"}
                  </Badge>
                </Td>
                <Td>
                  {c.doneCount} of {c.reviewCount} done
                </Td>
                <Td>
                  <ScoreText score={c.averageScore} />
                </Td>
                <Td className="text-right">
                  <Link href={`/performance/cycles/${c.id}`} className="text-sm font-medium text-[#00857a] hover:underline">
                    Open
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="New review cycle">
        <form onSubmit={create} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <Field label="Name">
            <Input required minLength={2} placeholder="Q4 2026" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="From">
              <Input type="date" required value={form.periodStart} onChange={(e) => setForm({ ...form, periodStart: e.target.value })} />
            </Field>
            <Field label="To">
              <Input type="date" required value={form.periodEnd} onChange={(e) => setForm({ ...form, periodEnd: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              Create cycle
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

function KpiList() {
  const { me } = useAuth();
  const scoring = me?.organization.kpiScoring ?? "BOTH";
  const measures = [
    ...(scoring !== "TARGET" ? [{ value: "RATING", label: "1–5 rating" }] : []),
    ...(scoring !== "RATING" ? [{ value: "TARGET", label: "Number target" }] : []),
  ];
  return (
    <CrudList<KpiTemplate & Record<string, unknown>>
      title="KPI list"
      itemName="KPI"
      path="/performance/kpis"
      canDelete={false}
      description="Your company's KPIs. Pick from these when you start a review cycle; managers can adjust targets and weights per person."
      fields={[
        { key: "name", label: "Name", required: true, placeholder: "Deals closed" },
        { key: "description", label: "What it means (optional)" },
        { key: "measure", label: "How it's scored", type: "select", required: true, defaultValue: measures[0]?.value, options: measures },
        { key: "unit", label: "Unit (for targets)", placeholder: "deals, PKR, %" },
        { key: "defaultTarget", label: "Usual target (for targets)", type: "number" },
        { key: "defaultWeight", label: "Usual weight (%)", type: "number", defaultValue: "20", required: true },
        { key: "higherIsBetter", label: "Higher is better (untick for things like complaints)", type: "checkbox", defaultValue: true },
        {
          key: "auto",
          label: "Filled automatically",
          type: "select",
          hint: "Punctuality uses each person's attendance rate over the cycle.",
          options: scoring === "RATING" ? [] : [{ value: "ATTENDANCE", label: "Punctuality from attendance" }],
        },
        { key: "isActive", label: "In use", type: "checkbox", defaultValue: true },
      ]}
      columns={[
        { label: "KPI", render: (k) => <span className="font-medium text-slate-900">{k.name}</span> },
        {
          label: "Scored by",
          render: (k) => (k.auto ? "Attendance (auto)" : k.measure === "RATING" ? "1–5 rating" : `Target${k.unit ? ` (${k.unit})` : ""}`),
        },
        { label: "Usual target", render: (k) => (k.measure === "TARGET" && k.defaultTarget !== null ? `${k.defaultTarget}${k.unit ? ` ${k.unit}` : ""}` : "—") },
        { label: "Weight", render: (k) => `${k.defaultWeight}%` },
        { label: "", render: (k) => (k.isActive ? null : <Badge>Not in use</Badge>) },
      ]}
    />
  );
}
