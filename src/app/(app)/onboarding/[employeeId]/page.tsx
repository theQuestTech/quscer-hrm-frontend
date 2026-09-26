"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { formatDate, fullName } from "@/lib/format";
import type { EmployeeOnboarding, OnboardingAssignee, OnboardingTask } from "@/lib/types";
import { Alert, Button, Card, EmptyState, Field, Input, Select, Spinner, cx } from "@/components/ui";
import { PersonAvatar } from "@/components/photo";
import { ASSIGNEE_LABEL, ProgressBar, isOverdue } from "@/components/onboarding";

const GROUPS: OnboardingAssignee[] = ["HR", "MANAGER", "EMPLOYEE"];

export default function EmployeeOnboardingPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const data = useApi<EmployeeOnboarding>(`/onboarding/employees/${employeeId}`);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (data.loading && !data.data) return <Spinner />;
  if (data.error) return <Alert>{data.error}</Alert>;
  const d = data.data;
  if (!d) return null;
  const e = d.employee;
  const done = d.tasks.filter((t) => t.doneAt).length;

  async function act(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await data.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Link href="/onboarding" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="size-4" /> Onboarding
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <PersonAvatar person={e} size={56} photo={e.photoUpdatedAt ? { employeeId: e.id, updatedAt: e.photoUpdatedAt } : null} />
          <div>
            <h1 className="text-2xl font-bold text-[#1a1a2e]" style={{ fontFamily: "var(--font-display)" }}>
              {fullName(e)}
            </h1>
            <p className="text-sm text-slate-500">
              {e.designation} · joining {formatDate(e.dateOfJoining)}
            </p>
          </div>
        </div>
        {d.tasks.length > 0 && <ProgressBar done={done} total={d.tasks.length} />}
      </div>
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {d.tasks.length === 0 ? (
        <Card>
          <EmptyState
            title="Onboarding hasn't started"
            description={d.canManage ? "Start it to copy your company's joining checklist onto this person." : "HR hasn't started a joining checklist for this person."}
            action={
              d.canManage && (
                <Button loading={busy === "start"} onClick={() => act("start", () => api("POST", `/onboarding/employees/${e.id}/start`))}>
                  Start onboarding
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {GROUPS.map((g) => {
            const tasks = d.tasks.filter((t) => t.assignee === g);
            return (
              <Card key={g} title={g === "EMPLOYEE" ? `${e.firstName} (new joiner)` : ASSIGNEE_LABEL[g]}>
                {tasks.length === 0 ? (
                  <p className="text-sm text-slate-400">No tasks</p>
                ) : (
                  <ul className="space-y-3">
                    {tasks.map((t) => (
                      <TaskRow
                        key={t.id}
                        t={t}
                        canDelete={d.canManage}
                        busy={busy === t.id}
                        onTick={(doneNow) => {
                          // Tick straight away; the server's answer follows.
                          data.setData({ ...d, tasks: d.tasks.map((x) => (x.id === t.id ? { ...x, doneAt: doneNow ? new Date().toISOString() : null } : x)) });
                          act(t.id, () => api("PATCH", `/onboarding/tasks/${t.id}`, { done: doneNow }));
                        }}
                        onDelete={() => window.confirm("Remove this task?") && act(t.id, () => api("DELETE", `/onboarding/tasks/${t.id}`))}
                      />
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
          {d.canManage && (
            <div className="lg:col-span-3">
              <AddTask employeeId={e.id} onAdded={data.reload} />
            </div>
          )}
        </div>
      )}
    </>
  );
}

function TaskRow({
  t, canDelete, busy, onTick, onDelete,
}: { t: OnboardingTask; canDelete: boolean; busy: boolean; onTick: (done: boolean) => void; onDelete: () => void }) {
  const overdue = isOverdue(t.dueDate, t.doneAt);
  return (
    <li className="flex items-start gap-3">
      <input
        type="checkbox"
        className="mt-1 size-4"
        checked={!!t.doneAt}
        disabled={!t.canTick || busy}
        aria-label={`Done: ${t.title}`}
        onChange={(ev) => onTick(ev.target.checked)}
      />
      <div className="min-w-0 flex-1">
        <p className={cx("text-sm font-medium", t.doneAt ? "text-slate-400 line-through" : "text-slate-900")}>{t.title}</p>
        {t.description && <p className="text-xs text-slate-500">{t.description}</p>}
        <p className={cx("text-xs", overdue ? "font-semibold text-red-600" : "text-slate-500")}>
          {t.doneAt ? `Done ${formatDate(t.doneAt)}` : `${overdue ? "Overdue · due" : "Due"} ${formatDate(t.dueDate)}`}
        </p>
      </div>
      {canDelete && (
        <button type="button" onClick={onDelete} className="text-slate-400 hover:text-red-600" aria-label={`Remove ${t.title}`}>
          <Trash2 className="size-4" />
        </button>
      )}
    </li>
  );
}

function AddTask({ employeeId, onAdded }: { employeeId: string; onAdded: () => void }) {
  const [form, setForm] = useState({ title: "", assignee: "HR", dueDate: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card title="Add a task for this person">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={async (ev) => {
          ev.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await api("POST", "/onboarding/tasks", { employeeId, ...form, title: form.title.trim() });
            setForm({ title: "", assignee: "HR", dueDate: "" });
            onAdded();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not add");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="min-w-64 flex-1">
          <Field label="Task">
            <Input required minLength={2} value={form.title} onChange={(ev) => setForm({ ...form, title: ev.target.value })} />
          </Field>
        </div>
        <Field label="Who does it">
          <Select value={form.assignee} onChange={(ev) => setForm({ ...form, assignee: ev.target.value })}>
            {GROUPS.map((g) => (
              <option key={g} value={g}>
                {ASSIGNEE_LABEL[g]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due">
          <Input type="date" required value={form.dueDate} onChange={(ev) => setForm({ ...form, dueDate: ev.target.value })} />
        </Field>
        <Button type="submit" loading={busy}>
          Add task
        </Button>
      </form>
      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}
    </Card>
  );
}
