"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { formatDate, fullName } from "@/lib/format";
import type { Employee, OnboardingOverviewItem, OnboardingTask, OnboardingTemplate, Paginated } from "@/lib/types";
import { Alert, Badge, Button, Card, EmptyState, Field, PageHeader, Select, Spinner, Table, Tabs, Td, Th, cx } from "@/components/ui";
import { PersonAvatar } from "@/components/photo";
import { CrudList } from "../settings/crud-list";
import { ASSIGNEE_LABEL, ProgressBar, dueText, isOverdue } from "@/components/onboarding";

type Tab = "todo" | "joiners" | "checklist";

export default function OnboardingPage() {
  const { can } = useAuth();
  const isHr = can("hrm.employee.write") || can("hrm.settings.write");
  const tabs: { id: Tab; label: string }[] = [
    { id: "todo", label: "My to-dos" },
    { id: "joiners", label: "New joiners" },
    ...(isHr ? [{ id: "checklist" as Tab, label: "Checklist" }] : []),
  ];
  const [tab, setTab] = useState<Tab>("todo");
  return (
    <>
      <PageHeader title="Onboarding" description="Joining checklists for new people — for HR, their manager and the new joiner" />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "todo" && <Todos />}
      {tab === "joiners" && <Joiners isHr={isHr} />}
      {tab === "checklist" && <Checklist />}
    </>
  );
}

function Todos() {
  const list = useApi<OnboardingTask[]>("/onboarding/mine");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (list.loading && !list.data) return <Spinner />;
  if (list.error) return <Alert>{list.error}</Alert>;
  if (!list.data?.length) {
    return (
      <Card>
        <EmptyState title="Nothing to do" description="Joining tasks for you show up here." />
      </Card>
    );
  }

  async function tick(t: OnboardingTask) {
    setBusy(t.id);
    setError(null);
    try {
      await api("PATCH", `/onboarding/tasks/${t.id}`, { done: true });
      list.setData((list.data ?? []).filter((x) => x.id !== t.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card padded={false}>
      {error && (
        <div className="p-4 pb-0">
          <Alert>{error}</Alert>
        </div>
      )}
      <ul className="divide-y divide-slate-100">
        {list.data.map((t) => (
          <li key={t.id} className="flex items-start gap-3 px-5 py-4">
            <input
              type="checkbox"
              className="mt-1 size-4"
              aria-label={`Done: ${t.title}`}
              disabled={busy === t.id}
              onChange={() => tick(t)}
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">{t.title}</p>
              {t.description && <p className="text-sm text-slate-500">{t.description}</p>}
              <p className="mt-1 text-xs text-slate-500">
                {t.forMe ? "Your joining task" : (
                  <>
                    For{" "}
                    <Link href={`/onboarding/${t.employeeId}`} className="font-medium text-[#00857a] hover:underline">
                      {t.employee && fullName(t.employee)}
                    </Link>{" "}
                    · {ASSIGNEE_LABEL[t.assignee]} task
                  </>
                )}
              </p>
            </div>
            <span className={cx("shrink-0 text-xs", isOverdue(t.dueDate, t.doneAt) ? "font-semibold text-red-600" : "text-slate-500")}>
              {isOverdue(t.dueDate, t.doneAt) ? "Overdue · " : "Due "}
              {formatDate(t.dueDate)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Joiners({ isHr }: { isHr: boolean }) {
  const router = useRouter();
  const list = useApi<OnboardingOverviewItem[]>("/onboarding");
  const people = useApi<Paginated<Employee>>(isHr ? "/employees?pageSize=100&status=ACTIVE" : null);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = new Set((list.data ?? []).map((x) => x.employee.id));

  return (
    <div className="space-y-6">
      {isHr && (
        <Card title="Start onboarding">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!pick) return;
              setBusy(true);
              setError(null);
              try {
                await api("POST", `/onboarding/employees/${pick}/start`);
                router.push(`/onboarding/${pick}`);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not start");
                setBusy(false);
              }
            }}
          >
            <div className="min-w-64 flex-1">
              <Field label="Employee" hint="People hired through Recruitment start automatically.">
                <Select value={pick} onChange={(e) => setPick(e.target.value)}>
                  <option value="">Choose someone…</option>
                  {people.data?.items
                    .filter((p) => !started.has(p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {fullName(p)} · joined {formatDate(p.dateOfJoining)}
                      </option>
                    ))}
                </Select>
              </Field>
            </div>
            <Button type="submit" loading={busy} disabled={!pick}>
              Start checklist
            </Button>
          </form>
          {error && (
            <div className="mt-3">
              <Alert>{error}</Alert>
            </div>
          )}
        </Card>
      )}
      <Card padded={false} title="People being onboarded">
        {list.loading && !list.data ? (
          <Spinner />
        ) : list.error ? (
          <div className="p-4">
            <Alert>{list.error}</Alert>
          </div>
        ) : !list.data?.length ? (
          <EmptyState title="No one yet" description={isHr ? "Start a checklist above, or hire someone through Recruitment." : "New joiners in your team show up here."} />
        ) : (
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <Th>Person</Th>
                <Th>Joining date</Th>
                <Th>Progress</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.data.map((x) => (
                <tr key={x.employee.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <PersonAvatar person={x.employee} photo={x.employee.photoUpdatedAt ? { employeeId: x.employee.id, updatedAt: x.employee.photoUpdatedAt } : null} />
                      <div>
                        <p className="font-medium text-slate-900">{fullName(x.employee)}</p>
                        <p className="text-xs text-slate-500">{x.employee.designation}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>{formatDate(x.employee.dateOfJoining)}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <ProgressBar done={x.done} total={x.total} />
                      {x.overdue > 0 && <Badge tone="red">{x.overdue} overdue</Badge>}
                      {x.done === x.total && <Badge tone="green">Complete</Badge>}
                    </div>
                  </Td>
                  <Td className="text-right">
                    <Link href={`/onboarding/${x.employee.id}`} className="text-sm font-medium text-[#00857a] hover:underline">
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
  );
}

function Checklist() {
  const templates = useApi<OnboardingTemplate[]>("/onboarding/templates");
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {templates.data?.length === 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-slate-900">Start with our suggested checklist</p>
              <p className="text-sm text-slate-500">
                11 common steps for Pakistani companies — CNIC copy, appointment letter, EOBI registration, probation check-in and more. You can edit them after.
              </p>
            </div>
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  templates.setData(await api<OnboardingTemplate[]>("POST", "/onboarding/templates/suggested"));
                  setVersion((v) => v + 1);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not add");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Use suggested checklist
            </Button>
          </div>
          {error && (
            <div className="mt-3">
              <Alert>{error}</Alert>
            </div>
          )}
        </Card>
      )}
      <CrudList<OnboardingTemplate & Record<string, unknown>>
        key={version}
        title="Joining checklist"
        itemName="checklist item"
        path="/onboarding/templates"
        description="Copied onto each new joiner when their onboarding starts. Changes here don't affect checklists already started."
        fields={[
          { key: "title", label: "Task", required: true, placeholder: "Upload a copy of your CNIC" },
          { key: "description", label: "More detail (optional)" },
          {
            key: "assignee",
            label: "Who does it",
            type: "select",
            required: true,
            defaultValue: "HR",
            options: [
              { value: "HR", label: "HR" },
              { value: "MANAGER", label: "The new joiner's manager" },
              { value: "EMPLOYEE", label: "The new joiner" },
            ],
          },
          { key: "dueDays", label: "Due (days after joining)", type: "number", defaultValue: "0", hint: "Use a minus number for before joining, e.g. -2" },
          { key: "isActive", label: "In use", type: "checkbox", defaultValue: true },
        ]}
        columns={[
          { label: "Task", render: (t) => <span className="font-medium text-slate-900">{t.title}</span> },
          { label: "Who", render: (t) => ASSIGNEE_LABEL[t.assignee] },
          { label: "Due", render: (t) => dueText(t.dueDays) },
          { label: "", render: (t) => (t.isActive ? null : <Badge>Not in use</Badge>) },
        ]}
      />
    </div>
  );
}
