"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { formatDate, formatMoney, fullName } from "@/lib/format";
import type {
  Employee, Paginated, TrainingCourse, TrainingOverview, TrainingRecord, TrainingReport, TrainingRequest, TrainingSessionSummary,
} from "@/lib/types";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Stat, Table, Tabs, Td, Th } from "@/components/ui";
import { PersonAvatar } from "@/components/photo";
import { CrudList } from "../settings/crud-list";
import {
  AskTrainingModal, CertificateBadge, DELIVERY_LABEL, RequestBadge, TrainingOverviewView, hoursText, sessionWhen,
} from "@/components/training";

type Tab = "mine" | "requests" | "sessions" | "courses" | "certificates" | "report";

export default function TrainingPage() {
  const { me, can } = useAuth();
  const isHr = can("hrm.employee.write") || can("hrm.settings.write");
  const isManager = !isHr && (can("hrm.leave.approve") || can("hrm.attendance.approve"));
  const tabs: { id: Tab; label: string }[] = [
    ...(me?.employee ? [{ id: "mine" as Tab, label: "My training" }] : []),
    ...(isHr || isManager ? [{ id: "requests" as Tab, label: "Requests" }] : []),
    ...(isHr ? [{ id: "sessions" as Tab, label: "Sessions" }, { id: "courses" as Tab, label: "Courses" }] : []),
    ...(isHr || isManager ? [{ id: "certificates" as Tab, label: "Expiring certificates" }] : []),
    ...(isHr ? [{ id: "report" as Tab, label: "Report" }] : []),
  ];
  const [tab, setTab] = useState<Tab>(isHr ? "sessions" : "mine");

  if (!me?.organization.modules.includes("training")) {
    return <Alert tone="info">Training isn&apos;t turned on for this company. HR can turn it on in Settings.</Alert>;
  }
  return (
    <>
      <PageHeader title="Training" description="Courses, sessions, certificates and training hours" />
      {tabs.length > 1 && <Tabs tabs={tabs} value={tab} onChange={setTab} />}
      {tab === "mine" && <Mine />}
      {tab === "requests" && <Requests isHr={isHr} />}
      {tab === "sessions" && <Sessions />}
      {tab === "courses" && <Courses />}
      {tab === "certificates" && <Expiring />}
      {tab === "report" && <Report />}
    </>
  );
}

// --- My training ------------------------------------------------------------------

function Mine() {
  const data = useApi<TrainingOverview>("/training/mine");
  const requests = useApi<TrainingRequest[]>("/training/requests?scope=mine");
  const courses = useApi<TrainingCourse[]>("/training/courses");
  const [asking, setAsking] = useState(false);
  if (data.loading && !data.data) return <Spinner />;
  if (data.error) return <Alert>{data.error}</Alert>;
  if (!data.data) return null;
  return (
    <div className="space-y-6">
      <TrainingOverviewView data={data.data} onChange={data.reload} self />
      <Card
        title="My training requests"
        padded={false}
        actions={
          <Button size="sm" onClick={() => setAsking(true)}>
            Ask for training
          </Button>
        }
      >
        {!requests.data?.length ? (
          <EmptyState title="No requests" description="Need a course to do your job better? Ask for it here." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {requests.data.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 px-5 py-4">
                <div>
                  <p className="font-medium text-slate-900">{r.title}</p>
                  <p className="text-sm text-slate-500">{r.reason}</p>
                  {r.decisionNote && <p className="mt-1 text-sm text-slate-600">“{r.decisionNote}”</p>}
                </div>
                <RequestBadge status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      {asking && (
        <AskTrainingModal
          courses={courses.data ?? []}
          onClose={() => setAsking(false)}
          onDone={() => {
            setAsking(false);
            requests.reload();
          }}
        />
      )}
    </div>
  );
}

// --- Requests (manager / HR) ----------------------------------------------------------

function Requests({ isHr }: { isHr: boolean }) {
  const list = useApi<TrainingRequest[]>("/training/requests?scope=team");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(r: TrainingRequest, approve: boolean) {
    const note = approve ? "" : window.prompt("Reason (optional, the employee sees it)") ?? null;
    if (note === null) return;
    setBusy(r.id);
    setError(null);
    try {
      await api("POST", `/training/requests/${r.id}/decide`, { approve, note: note || null });
      await list.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(null);
    }
  }

  if (list.loading && !list.data) return <Spinner />;
  if (list.error) return <Alert>{list.error}</Alert>;
  return (
    <Card padded={false}>
      {error && (
        <div className="p-4 pb-0">
          <Alert>{error}</Alert>
        </div>
      )}
      {!list.data?.length ? (
        <EmptyState title="No training requests" description={isHr ? "Requests from employees show up here." : "Requests from your team show up here."} />
      ) : (
        <Table>
          <thead className="bg-slate-50">
            <tr>
              <Th>Person</Th>
              <Th>Training</Th>
              <Th>Asked on</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.data.map((r) => (
              <tr key={r.id}>
                <Td>
                  <div className="flex items-center gap-3">
                    {r.employee && <PersonAvatar person={r.employee} photo={r.employee.photoUpdatedAt ? { employeeId: r.employee.id, updatedAt: r.employee.photoUpdatedAt } : null} />}
                    <span className="font-medium text-slate-900">{r.employee && fullName(r.employee)}</span>
                  </div>
                </Td>
                <Td>
                  <p className="font-medium text-slate-900">{r.title}</p>
                  <p className="max-w-md text-xs text-slate-500">{r.reason}</p>
                </Td>
                <Td>{formatDate(r.createdAt)}</Td>
                <Td>
                  <RequestBadge status={r.status} />
                </Td>
                <Td className="text-right">
                  {r.canDecide && (
                    <div className="flex justify-end gap-2">
                      <Button size="sm" loading={busy === r.id} onClick={() => decide(r, true)}>
                        Approve
                      </Button>
                      <Button size="sm" variant="secondary" disabled={busy === r.id} onClick={() => decide(r, false)}>
                        Turn down
                      </Button>
                    </div>
                  )}
                  {isHr && r.status === "APPROVED" && (r.courseId ? <span className="text-xs text-slate-500">Book them on a session</span> : <span className="text-xs text-slate-500">Add the course, then book</span>)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

// --- Sessions (HR) -------------------------------------------------------------------

function Sessions() {
  const router = useRouter();
  const [when, setWhen] = useState<"upcoming" | "past">("upcoming");
  const list = useApi<TrainingSessionSummary[]>(`/training/sessions?when=${when}`);
  const [planning, setPlanning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <>
      {message && (
        <div className="mb-4">
          <Alert tone="success">{message}</Alert>
        </div>
      )}
      <Card
        title="Training sessions"
        padded={false}
        actions={
          <div className="flex flex-wrap gap-2">
            <Select aria-label="Which sessions" value={when} onChange={(e) => setWhen(e.target.value as typeof when)}>
              <option value="upcoming">Upcoming</option>
              <option value="past">Past and cancelled</option>
            </Select>
            <Button size="sm" variant="secondary" onClick={() => setRecording(true)}>
              Record outside training
            </Button>
            <Button size="sm" onClick={() => setPlanning(true)}>
              Plan a session
            </Button>
          </div>
        }
      >
        {list.loading && !list.data ? (
          <Spinner />
        ) : list.error ? (
          <div className="p-4">
            <Alert>{list.error}</Alert>
          </div>
        ) : !list.data?.length ? (
          <EmptyState
            title={when === "upcoming" ? "No sessions planned" : "No past sessions"}
            description={when === "upcoming" ? "Add courses on the Courses tab, then plan a session and enrol people." : undefined}
          />
        ) : (
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <Th>Course</Th>
                <Th>When</Th>
                <Th>People</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.data.map((s) => (
                <tr key={s.id}>
                  <Td>
                    <p className="font-medium text-slate-900">{s.course.title}</p>
                    <p className="text-xs text-slate-500">{[s.location, s.trainer].filter(Boolean).join(" · ") || DELIVERY_LABEL[s.course.delivery]}</p>
                  </Td>
                  <Td>{sessionWhen(s)}</Td>
                  <Td>
                    {s.status === "DONE" ? `${s.completed} of ${s.enrolled} completed` : `${s.enrolled}${s.capacity ? ` / ${s.capacity}` : ""}`}
                  </Td>
                  <Td>
                    {s.status === "CANCELLED" ? (
                      <Badge tone="red">Cancelled</Badge>
                    ) : s.status === "DONE" ? (
                      <Badge tone="green">Done</Badge>
                    ) : new Date(s.startsAt) < new Date() ? (
                      <Badge tone="yellow">Mark attendance</Badge>
                    ) : (
                      <Badge tone="blue">Planned</Badge>
                    )}
                  </Td>
                  <Td className="text-right">
                    <Link href={`/training/sessions/${s.id}`} className="text-sm font-medium text-[#00857a] hover:underline">
                      Open
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {planning && <PlanSession onClose={() => setPlanning(false)} onDone={(id) => router.push(`/training/sessions/${id}`)} />}
      {recording && (
        <RecordOutside
          onClose={() => setRecording(false)}
          onDone={(text) => {
            setRecording(false);
            setMessage(text);
          }}
        />
      )}
    </>
  );
}

function PlanSession({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const courses = useApi<TrainingCourse[]>("/training/courses");
  const [form, setForm] = useState({ courseId: "", date: "", from: "09:00", to: "13:00", location: "", trainer: "", capacity: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = (courses.data ?? []).filter((c) => c.isActive);
  return (
    <Modal open onClose={onClose} title="Plan a training session">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const s = await api<{ id: string }>("POST", "/training/sessions", {
              courseId: form.courseId,
              startsAt: new Date(`${form.date}T${form.from}`).toISOString(),
              endsAt: new Date(`${form.date}T${form.to}`).toISOString(),
              location: form.location.trim() || null,
              trainer: form.trainer.trim() || null,
              capacity: form.capacity ? Number(form.capacity) : null,
            });
            onDone(s.id);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save");
            setBusy(false);
          }
        }}
      >
        {error && <Alert>{error}</Alert>}
        {courses.data && active.length === 0 && <Alert tone="info">Add a course on the Courses tab first.</Alert>}
        <Field label="Course">
          <Select required value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
            <option value="">Choose…</option>
            {active.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date">
            <Input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="From">
            <Input type="time" required value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
          </Field>
          <Field label="To">
            <Input type="time" required value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
          </Field>
        </div>
        <Field label="Where (room, address or meeting link)">
          <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Head office training room" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Trainer (optional)">
            <Input value={form.trainer} onChange={(e) => setForm({ ...form, trainer: e.target.value })} />
          </Field>
          <Field label="Seats (optional)">
            <Input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Plan session
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RecordOutside({ onClose, onDone }: { onClose: () => void; onDone: (text: string) => void }) {
  const courses = useApi<TrainingCourse[]>("/training/courses");
  const people = useApi<Paginated<Employee>>("/employees?pageSize=100&status=ACTIVE");
  const [form, setForm] = useState({ employeeId: "", courseId: "", completedAt: "", hours: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal open onClose={onClose} title="Record training done elsewhere">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await api("POST", "/training/records", {
              employeeId: form.employeeId,
              courseId: form.courseId,
              completedAt: form.completedAt,
              ...(form.hours && { hours: Number(form.hours) }),
            });
            const p = people.data?.items.find((x) => x.id === form.employeeId);
            const c = courses.data?.find((x) => x.id === form.courseId);
            onDone(`Recorded ${c?.title} for ${p ? fullName(p) : "them"}.`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save");
            setBusy(false);
          }
        }}
      >
        {error && <Alert>{error}</Alert>}
        <p className="text-sm text-slate-600">For a course someone did outside, e.g. a first aid certificate they bring. It counts toward their hours and certificates.</p>
        <Field label="Employee">
          <Select required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
            <option value="">Choose…</option>
            {people.data?.items.map((p) => (
              <option key={p.id} value={p.id}>
                {fullName(p)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Course" hint="Not listed? Add it on the Courses tab first.">
          <Select required value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
            <option value="">Choose…</option>
            {courses.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Completed on">
            <Input type="date" required value={form.completedAt} onChange={(e) => setForm({ ...form, completedAt: e.target.value })} />
          </Field>
          <Field label="Hours (optional)">
            <Input type="number" min={0.5} step={0.5} value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Record
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// --- Courses (HR) --------------------------------------------------------------------

function Courses() {
  return (
    <CrudList<TrainingCourse & Record<string, unknown>>
      title="Courses"
      itemName="course"
      path="/training/courses"
      canDelete={false}
      description="What your company trains people on. Plan sessions from these, and employees can ask for them."
      fields={[
        { key: "title", label: "Course name", required: true, placeholder: "Fire Safety" },
        { key: "description", label: "What it covers (optional)" },
        { key: "category", label: "Category (optional)", placeholder: "Safety, Sales, Compliance…" },
        { key: "provider", label: "Run by (optional)", placeholder: "In-house, Rescue 1122…" },
        {
          key: "delivery",
          label: "How it's taught",
          type: "select",
          required: true,
          defaultValue: "CLASSROOM",
          options: Object.entries(DELIVERY_LABEL).map(([value, label]) => ({ value, label })),
        },
        { key: "durationHours", label: "Length in hours (optional)", type: "number", hint: "Left empty, each session's length is used" },
        { key: "costPerPerson", label: "Cost per person (optional)", type: "number" },
        { key: "validityMonths", label: "Certificate valid for (months, optional)", type: "number", hint: "e.g. 12 for first aid. Empty = never expires" },
        { key: "isActive", label: "In use", type: "checkbox", defaultValue: true },
      ]}
      columns={[
        {
          label: "Course",
          render: (c) => (
            <div>
              <p className="font-medium text-slate-900">{c.title}</p>
              <p className="text-xs text-slate-500">{[c.category, c.provider].filter(Boolean).join(" · ")}</p>
            </div>
          ),
        },
        { label: "Taught", render: (c) => DELIVERY_LABEL[c.delivery] },
        { label: "Hours", render: (c) => hoursText(c.durationHours) },
        { label: "Cost", render: (c) => (c.costPerPerson ? formatMoney(c.costPerPerson) : "—") },
        { label: "Certificate", render: (c) => (c.validityMonths ? `${c.validityMonths} months` : "No expiry") },
        { label: "", render: (c) => (c.isActive ? null : <Badge>Not in use</Badge>) },
      ]}
    />
  );
}

// --- Expiring certificates --------------------------------------------------------------

function Expiring() {
  const list = useApi<TrainingRecord[]>("/training/certificates/expiring");
  if (list.loading && !list.data) return <Spinner />;
  if (list.error) return <Alert>{list.error}</Alert>;
  return (
    <Card padded={false} title="Certificates that have expired or expire in the next 60 days">
      {!list.data?.length ? (
        <EmptyState title="All certificates are up to date" />
      ) : (
        <Table>
          <thead className="bg-slate-50">
            <tr>
              <Th>Person</Th>
              <Th>Course</Th>
              <Th>Valid until</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.data.map((r) => (
              <tr key={r.id}>
                <Td>
                  <Link href={`/training/people/${r.employeeId}`} className="font-medium text-slate-900 hover:text-[#00857a]">
                    {r.employee && fullName(r.employee)}
                  </Link>
                </Td>
                <Td>{r.course.title}</Td>
                <Td>{formatDate(r.certificateExpiresAt)}</Td>
                <Td>
                  <CertificateBadge state={r.certificate} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

// --- Report (HR) ----------------------------------------------------------------------

function Report() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const rep = useApi<TrainingReport>(`/training/report?year=${year}`);
  const r = rep.data;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <label htmlFor="rep-year" className="text-sm text-slate-600">
          Year
        </label>
        <div className="w-32">
          <Select id="rep-year" value={String(year)} onChange={(e) => setYear(Number(e.target.value))}>
            {[thisYear, thisYear - 1, thisYear - 2].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {rep.loading && !r ? (
        <Spinner />
      ) : rep.error ? (
        <Alert>{rep.error}</Alert>
      ) : r ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Training hours" value={hoursText(r.totals.hours) === "—" ? "0 h" : hoursText(r.totals.hours)} />
            <Stat label="People trained" value={`${r.totals.trained} of ${r.totals.people}`} />
            <Stat label="Average per person" value={r.totals.people ? hoursText(r.totals.hours / r.totals.people) : "—"} />
            <Stat label="Training cost" value={formatMoney(r.totals.cost)} />
          </div>
          <Card title="By department" padded={false}>
            <Table>
              <thead className="bg-slate-50">
                <tr>
                  <Th>Department</Th>
                  <Th>People</Th>
                  <Th>Hours</Th>
                  <Th>Hours per person</Th>
                  <Th>Cost</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {r.byDepartment.map((d) => (
                  <tr key={d.department}>
                    <Td className="font-medium text-slate-900">{d.department}</Td>
                    <Td>{d.people}</Td>
                    <Td>{hoursText(d.hours)}</Td>
                    <Td>{hoursText(d.people ? d.hours / d.people : 0)}</Td>
                    <Td>{d.cost ? formatMoney(d.cost) : "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
          <Card title="By person" padded={false}>
            <Table>
              <thead className="bg-slate-50">
                <tr>
                  <Th>Person</Th>
                  <Th>Hours</Th>
                  <Th>Courses</Th>
                  <Th>Didn&apos;t attend</Th>
                  <Th>Cost</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {r.people.map((p) => (
                  <tr key={p.employee.id}>
                    <Td>
                      <Link href={`/training/people/${p.employee.id}`} className="font-medium text-slate-900 hover:text-[#00857a]">
                        {fullName(p.employee)}
                      </Link>
                    </Td>
                    <Td>{hoursText(p.hours)}</Td>
                    <Td>{p.courses}</Td>
                    <Td>{p.noShows || "—"}</Td>
                    <Td>{p.cost ? formatMoney(p.cost) : "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      ) : null}
    </div>
  );
}
