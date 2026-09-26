"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { fullName } from "@/lib/format";
import type { Employee, Paginated, TrainingSessionDetail } from "@/lib/types";
import { Alert, Badge, Button, Card, EmptyState, Input, PageHeader, Spinner, cx } from "@/components/ui";
import { PersonAvatar } from "@/components/photo";
import { DELIVERY_LABEL, hoursText, sessionWhen } from "@/components/training";

type Result = { status: "COMPLETED" | "NO_SHOW"; score: string };

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const session = useApi<TrainingSessionDetail>(`/training/sessions/${id}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (session.loading && !session.data) return <Spinner />;
  if (session.error) return <Alert>{session.error}</Alert>;
  const s = session.data;
  if (!s) return null;
  const people = s.enrolments.filter((e) => e.status !== "CANCELLED");
  const started = new Date(s.startsAt) <= new Date();
  const canEnrol = s.status === "PLANNED";

  async function act(key: string, fn: () => Promise<TrainingSessionDetail | unknown>) {
    setBusy(key);
    setError(null);
    try {
      const next = await fn();
      if (next && typeof next === "object" && "enrolments" in next) session.setData(next as TrainingSessionDetail);
      else await session.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Link href="/training" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="size-4" /> Training
      </Link>
      <PageHeader
        title={s.course.title}
        description={[sessionWhen(s), s.location, s.trainer && `Trainer: ${s.trainer}`].filter(Boolean).join(" · ")}
        actions={
          <div className="flex items-center gap-2">
            {s.status === "CANCELLED" ? <Badge tone="red">Cancelled</Badge> : s.status === "DONE" ? <Badge tone="green">Done</Badge> : <Badge tone="blue">Planned</Badge>}
            {s.status === "PLANNED" && (
              <Button
                variant="secondary"
                loading={busy === "cancel"}
                onClick={() =>
                  window.confirm("Cancel this session? Everyone booked on it is taken off.") &&
                  act("cancel", () => api("PATCH", `/training/sessions/${id}`, { status: "CANCELLED" }))
                }
              >
                Cancel session
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
      <p className="mb-6 text-sm text-slate-600">
        {DELIVERY_LABEL[s.course.delivery]}
        {s.course.durationHours ? ` · ${hoursText(s.course.durationHours)} per person` : ""}
        {s.course.validityMonths ? ` · certificate valid ${s.course.validityMonths} months` : ""}
        {s.capacity ? ` · ${people.length} of ${s.capacity} seats taken` : ` · ${people.length} booked`}
      </p>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {started && s.status !== "CANCELLED" && people.length > 0 ? (
            <Attendance s={s} busy={busy === "complete"} onSave={(results) => act("complete", () => api("POST", `/training/sessions/${id}/complete`, { results }))} />
          ) : (
            <Card title="Booked" padded={false}>
              {people.length === 0 ? (
                <EmptyState title="No one booked yet" description={canEnrol ? "Add people on the right." : undefined} />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {people.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="flex items-center gap-3">
                        <PersonAvatar person={e.employee} photo={e.employee.photoUpdatedAt ? { employeeId: e.employee.id, updatedAt: e.employee.photoUpdatedAt } : null} />
                        <div>
                          <p className="font-medium text-slate-900">{fullName(e.employee)}</p>
                          <p className="text-xs text-slate-500">{e.employee.designation}</p>
                        </div>
                      </div>
                      {canEnrol && e.status === "ENROLLED" && (
                        <Button size="sm" variant="ghost" loading={busy === e.id} onClick={() => act(e.id, () => api("DELETE", `/training/enrolments/${e.id}`))}>
                          Remove
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
        {canEnrol && (
          <AddPeople
            s={s}
            busy={busy === "enrol"}
            onAdd={(employeeIds) => act("enrol", () => api("POST", `/training/sessions/${id}/enrol`, { employeeIds }))}
          />
        )}
      </div>
    </>
  );
}

function AddPeople({ s, busy, onAdd }: { s: TrainingSessionDetail; busy: boolean; onAdd: (ids: string[]) => void }) {
  const people = useApi<Paginated<Employee>>("/employees?pageSize=100&status=ACTIVE");
  const [chosen, setChosen] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const booked = useMemo(() => new Set(s.enrolments.filter((e) => e.status !== "CANCELLED").map((e) => e.employeeId)), [s]);
  const waiting = s.waiting.filter((w) => !booked.has(w.employeeId));
  const list = (people.data?.items ?? []).filter(
    (p) => !booked.has(p.id) && `${p.firstName} ${p.lastName} ${p.designation}`.toLowerCase().includes(filter.toLowerCase()),
  );
  const toggle = (pid: string) => setChosen((c) => (c.includes(pid) ? c.filter((x) => x !== pid) : [...c, pid]));

  return (
    <Card title="Add people">
      <div className="space-y-4">
        {s.seatsLeft !== null && <p className="text-sm text-slate-600">{s.seatsLeft} seat{s.seatsLeft === 1 ? "" : "s"} left</p>}
        {waiting.length > 0 && (
          <div className="rounded-xl bg-[#e8faf8] p-3">
            <p className="mb-2 text-sm font-medium text-[#1a1a2e]">Asked for this course</p>
            {waiting.map((w) => (
              <label key={w.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={chosen.includes(w.employeeId)} onChange={() => toggle(w.employeeId)} />
                {fullName(w.employee)}
              </label>
            ))}
          </div>
        )}
        <div>
          <label htmlFor="people-filter" className="sr-only">
            Find people
          </label>
          <Input id="people-filter" placeholder="Find people" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {list.map((p) => (
            <label key={p.id} className={cx("flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50", chosen.includes(p.id) && "bg-slate-50")}>
              <input type="checkbox" checked={chosen.includes(p.id)} onChange={() => toggle(p.id)} />
              <span className="text-slate-900">{fullName(p)}</span>
              <span className="truncate text-xs text-slate-500">{p.designation}</span>
            </label>
          ))}
          {people.data && list.length === 0 && <p className="text-sm text-slate-400">Everyone is already booked</p>}
        </div>
        <Button
          className="w-full"
          loading={busy}
          disabled={chosen.length === 0}
          onClick={() => {
            onAdd(chosen);
            setChosen([]);
          }}
        >
          Book {chosen.length || ""} {chosen.length === 1 ? "person" : "people"}
        </Button>
      </div>
    </Card>
  );
}

function Attendance({ s, busy, onSave }: { s: TrainingSessionDetail; busy: boolean; onSave: (results: { enrolmentId: string; status: string; score?: number | null }[]) => void }) {
  const people = s.enrolments.filter((e) => e.status !== "CANCELLED");
  const [results, setResults] = useState<Record<string, Result>>(() =>
    Object.fromEntries(people.map((e) => [e.id, { status: e.status === "NO_SHOW" ? "NO_SHOW" : "COMPLETED", score: e.score === null ? "" : String(e.score) }])),
  );
  return (
    <Card title={s.status === "DONE" ? "Attendance (you can correct it)" : "Mark attendance"} padded={false}>
      <ul className="divide-y divide-slate-100">
        {people.map((e) => {
          const r = results[e.id];
          return (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="flex items-center gap-3">
                <PersonAvatar person={e.employee} photo={e.employee.photoUpdatedAt ? { employeeId: e.employee.id, updatedAt: e.employee.photoUpdatedAt } : null} />
                <p className="font-medium text-slate-900">{fullName(e.employee)}</p>
              </div>
              <div className="flex items-center gap-3">
                <div role="radiogroup" aria-label={`Attendance for ${fullName(e.employee)}`} className="flex rounded-xl bg-slate-100 p-1 text-sm">
                  {(["COMPLETED", "NO_SHOW"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={r.status === v}
                      onClick={() => setResults({ ...results, [e.id]: { ...r, status: v } })}
                      className={cx("rounded-lg px-3 py-1", r.status === v ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-500")}
                    >
                      {v === "COMPLETED" ? "Completed" : "Didn't attend"}
                    </button>
                  ))}
                </div>
                <label className="sr-only" htmlFor={`score-${e.id}`}>
                  Test score for {fullName(e.employee)}
                </label>
                <Input
                  id={`score-${e.id}`}
                  type="number"
                  min={0}
                  max={100}
                  placeholder="Score %"
                  className="w-24"
                  disabled={r.status !== "COMPLETED"}
                  value={r.score}
                  onChange={(ev) => setResults({ ...results, [e.id]: { ...r, score: ev.target.value } })}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
        <p className="text-xs text-slate-500">Completing gives hours{s.course.validityMonths ? " and a certificate" : ""}. Test score is optional.</p>
        <Button
          loading={busy}
          onClick={() =>
            onSave(
              people.map((e) => ({
                enrolmentId: e.id,
                status: results[e.id].status,
                ...(results[e.id].status === "COMPLETED" && results[e.id].score !== "" && { score: Number(results[e.id].score) }),
              })),
            )
          }
        >
          {s.status === "DONE" ? "Save changes" : "Save attendance"}
        </Button>
      </div>
    </Card>
  );
}
