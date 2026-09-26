"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api, downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { formatDate, formatMoney, formatRelative, formatTime, fullName, humanize, toDateInput } from "@/lib/format";
import type { ApplicationStage, CandidateDetail, Department, Employee, InterviewItem, Paginated, Branch } from "@/lib/types";
import { Alert, Badge, Button, Card, Field, Input, Modal, Select, Spinner, Textarea } from "@/components/ui";
import { RatingPicker } from "@/components/performance";
import {
  CandidateStageBadge, EMPLOYMENT_LABEL, RECOMMENDATION_LABEL, SOURCE_LABEL, STAGE_LABEL, Stars,
} from "@/components/recruitment";

// Pakistani mobile numbers → WhatsApp link (0300… → 92300…).
function whatsappLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const intl = digits.startsWith("0") ? `92${digits.slice(1)}` : digits;
  return intl.length >= 10 ? `https://wa.me/${intl}` : null;
}

const TIMELINE: Record<string, string> = {
  "recruitment.applied": "Applied on the careers page",
  "recruitment.candidate_added": "Added by HR",
  "recruitment.stage_changed": "Moved",
  "recruitment.interview_scheduled": "Interview scheduled",
  "recruitment.feedback_given": "Interview feedback given",
  "recruitment.offer_saved": "Offer prepared",
  "recruitment.offer_sent": "Offer sent",
  "recruitment.offer_accepted": "Offer accepted",
  "recruitment.offer_declined": "Offer declined",
  "recruitment.hired": "Hired",
};

export default function CandidatePage() {
  const { id } = useParams<{ id: string }>();
  const cand = useApi<CandidateDetail>(`/recruitment/applications/${id}`);
  const [error, setError] = useState<string | null>(null);

  if (cand.loading && !cand.data) return <Spinner />;
  if (cand.error) return <Alert>{cand.error}</Alert>;
  const c = cand.data;
  if (!c) return null;
  const wa = whatsappLink(c.phone);

  // Actions return the updated candidate.
  const update = (next: CandidateDetail) => cand.setData(next);

  return (
    <>
      <Link href={`/recruitment/jobs/${c.job.id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="size-4" /> {c.job.title}
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e]" style={{ fontFamily: "var(--font-display)" }}>
            {fullName(c)}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Applied for {c.job.title} · {formatDate(c.createdAt)} · {SOURCE_LABEL[c.source] ?? c.source}
          </p>
          <p className="mt-1 flex flex-wrap gap-x-4 text-sm">
            <a href={`mailto:${c.email}`} className="text-[#00857a] hover:underline">
              {c.email}
            </a>
            <a href={`tel:${c.phone}`} className="text-[#00857a] hover:underline">
              {c.phone}
            </a>
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" className="text-[#00857a] hover:underline">
                WhatsApp
              </a>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CandidateStageBadge stage={c.stage} />
        </div>
      </div>
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {c.stage === "HIRED" && c.hiredEmployeeId && (
        <div className="mb-6">
          <Alert tone="success">
            Hired.{" "}
            <Link href={`/employees/${c.hiredEmployeeId}`} className="font-medium underline">
              Open their employee profile
            </Link>{" "}
            ·{" "}
            <Link href={`/onboarding/${c.hiredEmployeeId}`} className="font-medium underline">
              Onboarding checklist
            </Link>
          </Alert>
        </div>
      )}
      {c.stage === "REJECTED" && (
        <div className="mb-6">
          <Alert tone="info">Not selected{c.rejectReason ? `: ${c.rejectReason}` : "."}</Alert>
        </div>
      )}
      {c.can.manage && <StageBar c={c} onChange={update} onError={setError} />}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Interviews c={c} onChange={update} />
          {c.can.manage || c.offer ? <Offer c={c} onChange={update} /> : null}
        </div>
        <div className="space-y-6">
          <Card title="Application">
            <dl className="space-y-3 text-sm">
              <Row label="City" value={c.city} />
              <Row label="Current company" value={c.currentCompany} />
              <Row label="Expected salary" value={c.expectedSalary ? formatMoney(c.expectedSalary) : null} />
              <Row label="Notice period" value={c.noticePeriodDays !== null ? `${c.noticePeriodDays} days` : null} />
            </dl>
            {c.coverNote && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="mb-1 text-xs text-slate-500">Message</p>
                <p className="whitespace-pre-line text-sm text-slate-700">{c.coverNote}</p>
              </div>
            )}
            <div className="mt-4">
              {c.cvFileName ? (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => downloadFile(`/recruitment/applications/${c.id}/cv`, c.cvFileName!).catch((e) => setError(e.message))}
                >
                  Download CV
                </Button>
              ) : (
                <p className="text-sm text-slate-400">No CV attached</p>
              )}
            </div>
          </Card>
          {c.notes !== null || c.can.manage ? <Notes c={c} /> : null}
          {c.timeline.length > 0 && (
            <Card title="History">
              <ol className="space-y-3">
                {c.timeline.map((t) => (
                  <li key={t.id} className="text-sm">
                    <p className="text-slate-800">
                      {TIMELINE[t.eventType] ?? humanize(t.eventType.replace("recruitment.", ""))}
                      {t.eventType === "recruitment.stage_changed" && typeof t.metadata.to === "string" && ` to ${STAGE_LABEL[t.metadata.to as ApplicationStage]}`}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t.actor ? fullName(t.actor) : "Candidate"} · {formatRelative(t.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-900">{value || "—"}</dd>
    </div>
  );
}

// --- Move / reject / hire ------------------------------------------------------

function StageBar({ c, onChange, onError }: { c: CandidateDetail; onChange: (c: CandidateDetail) => void; onError: (e: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [hiring, setHiring] = useState(false);
  const next: Partial<Record<ApplicationStage, ApplicationStage>> = { APPLIED: "SCREENING", SCREENING: "INTERVIEW", REJECTED: "SCREENING" };

  async function move(stage: ApplicationStage, rejectReason?: string) {
    setBusy(true);
    onError(null);
    try {
      onChange(await api<CandidateDetail>("POST", `/recruitment/applications/${c.id}/move`, { stage, ...(rejectReason && { rejectReason }) }));
      setRejecting(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not move");
    } finally {
      setBusy(false);
    }
  }

  const step = next[c.stage];
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <span className="mr-2 text-sm text-slate-600">Next step:</span>
      {step && (
        <Button size="sm" onClick={() => move(step)} loading={busy}>
          {c.stage === "REJECTED" ? "Bring back to screening" : `Move to ${STAGE_LABEL[step]}`}
        </Button>
      )}
      {c.stage === "INTERVIEW" && <span className="text-sm text-slate-500">Schedule interviews below, then make an offer.</span>}
      {c.can.hire && (
        <Button size="sm" onClick={() => setHiring(true)} disabled={c.offer?.status === "DECLINED"}>
          Hire
        </Button>
      )}
      {c.stage !== "REJECTED" && (
        <Button size="sm" variant="secondary" onClick={() => setRejecting(true)}>
          Not selected
        </Button>
      )}
      {rejecting && <RejectModal busy={busy} onClose={() => setRejecting(false)} onReject={(reason) => move("REJECTED", reason)} />}
      {hiring && <HireModal c={c} onClose={() => setHiring(false)} onHired={() => window.location.reload()} />}
    </div>
  );
}

function RejectModal({ busy, onClose, onReject }: { busy: boolean; onClose: () => void; onReject: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Modal open onClose={onClose} title="Not selected">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onReject(reason.trim());
        }}
        className="space-y-4"
      >
        <Field label="Reason (only HR sees this)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Not enough experience" maxLength={300} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={busy}>
            Mark as not selected
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function HireModal({ c, onClose, onHired }: { c: CandidateDetail; onClose: () => void; onHired: () => void }) {
  const departments = useApi<Department[]>("/departments");
  const branches = useApi<Branch[]>("/branches");
  const people = useApi<Paginated<Employee>>("/employees?pageSize=100&status=ACTIVE");
  const [form, setForm] = useState({
    employeeNumber: "",
    departmentId: c.job.departmentId ?? "",
    branchId: c.job.branchId ?? "",
    managerId: "",
    employmentType: c.job.employmentType ?? "FULL_TIME",
    startOnboarding: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ employeeId: string; onboarding: { started: boolean; reason?: string } } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setDone(
        await api("POST", `/recruitment/applications/${c.id}/hire`, {
          employeeNumber: form.employeeNumber.trim(),
          employmentType: form.employmentType,
          startOnboarding: form.startOnboarding,
          ...(form.departmentId && { departmentId: form.departmentId }),
          ...(form.branchId && { branchId: form.branchId }),
          ...(form.managerId && { managerId: form.managerId }),
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not hire");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Modal open onClose={onHired} title={`${fullName(c)} is hired`}>
        <div className="space-y-4">
          <Alert tone="success">
            Their employee profile is ready with a basic salary of {formatMoney(c.offer!.salary)}, joining on {formatDate(c.offer!.joiningDate)}. Their CV is
            saved under Documents.
          </Alert>
          {done.onboarding.started ? (
            <p className="text-sm text-slate-700">Their onboarding checklist has started.</p>
          ) : (
            done.onboarding.reason && <Alert tone="info">{done.onboarding.reason}</Alert>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {done.onboarding.started && (
              <Link href={`/onboarding/${done.employeeId}`} className="rounded-xl px-3.5 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
                Onboarding checklist
              </Link>
            )}
            <Link href={`/employees/${done.employeeId}`} className="rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700">
              Open employee profile
            </Link>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={`Hire ${fullName(c)}`}>
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <p className="text-sm text-slate-600">
          This adds {c.firstName} as an employee: <strong>{c.offer?.designation}</strong>, basic salary{" "}
          <strong>{c.offer && formatMoney(c.offer.salary)}</strong>, joining <strong>{c.offer && formatDate(c.offer.joiningDate)}</strong>.
        </p>
        <Field label="Employee number">
          <Input required value={form.employeeNumber} onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })} placeholder="EMP-014" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Department">
            <Select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
              <option value="">—</option>
              {departments.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Branch">
            <Select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">—</option>
              {branches.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reports to">
            <Select value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })}>
              <option value="">—</option>
              {people.data?.items.map((p) => (
                <option key={p.id} value={p.id}>
                  {fullName(p)} · {p.designation}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Type">
            <Select value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value as typeof form.employmentType })}>
              {Object.entries(EMPLOYMENT_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.startOnboarding} onChange={(e) => setForm({ ...form, startOnboarding: e.target.checked })} />
          Start their onboarding checklist
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Hire
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// --- Notes ---------------------------------------------------------------------

function Notes({ c }: { c: CandidateDetail }) {
  const [notes, setNotes] = useState(c.notes ?? "");
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Card title="HR notes">
      <div className="space-y-3">
        <label htmlFor="hr-notes" className="sr-only">
          HR notes
        </label>
        <Textarea id="hr-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Only HR sees these notes" />
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500" role="status">
            {saved}
          </span>
          <Button
            size="sm"
            variant="secondary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api("PUT", `/recruitment/applications/${c.id}/notes`, { notes });
                setSaved("Saved");
              } catch (e) {
                setSaved(e instanceof Error ? e.message : "Could not save");
              } finally {
                setBusy(false);
              }
            }}
          >
            Save notes
          </Button>
        </div>
      </div>
    </Card>
  );
}

// --- Interviews ----------------------------------------------------------------

function Interviews({ c, onChange }: { c: CandidateDetail; onChange: (c: CandidateDetail) => void }) {
  const [scheduling, setScheduling] = useState(false);
  const canSchedule = c.can.manage && c.stage !== "REJECTED";
  return (
    <Card
      title="Interviews"
      actions={
        canSchedule && (
          <Button size="sm" onClick={() => setScheduling(true)}>
            Schedule interview
          </Button>
        )
      }
    >
      {c.interviews.length === 0 ? (
        <p className="text-sm text-slate-500">No interviews yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {c.interviews.map((i) => (
            <InterviewRow key={i.id} i={i} canManage={c.can.manage} onChange={onChange} />
          ))}
        </ul>
      )}
      {scheduling && <ScheduleModal c={c} onClose={() => setScheduling(false)} onDone={(next) => (onChange(next), setScheduling(false))} />}
    </Card>
  );
}

function InterviewRow({ i, canManage, onChange }: { i: InterviewItem; canManage: boolean; onChange: (c: CandidateDetail) => void }) {
  const [giving, setGiving] = useState(false);
  const [busy, setBusy] = useState(false);
  const how = i.mode === "VIDEO" ? "Video call" : i.mode === "PHONE" ? "Phone" : "In person";
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-900">
            {formatDate(i.scheduledAt)}, {formatTime(i.scheduledAt)} · {how}
          </p>
          <p className="text-sm text-slate-500">
            {i.interviewer ? `With ${fullName(i.interviewer)}` : "Interviewer not set"} · {i.durationMinutes} min
            {i.location && (
              <>
                {" · "}
                {/^https?:\/\//.test(i.location) ? (
                  <a href={i.location} target="_blank" rel="noreferrer" className="text-[#00857a] hover:underline">
                    Join link
                  </a>
                ) : (
                  i.location
                )}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {i.status === "CANCELLED" && <Badge>Cancelled</Badge>}
          {i.status === "DONE" && i.recommendation && <Badge tone={i.recommendation === "HIRE" ? "green" : i.recommendation === "NO_HIRE" ? "red" : "yellow"}>Says: {RECOMMENDATION_LABEL[i.recommendation]}</Badge>}
          {i.canGiveFeedback && !giving && (
            <Button size="sm" variant={i.status === "DONE" ? "ghost" : "primary"} onClick={() => setGiving(true)}>
              {i.status === "DONE" ? "Edit feedback" : "Give feedback"}
            </Button>
          )}
          {canManage && i.status === "SCHEDULED" && (
            <Button
              size="sm"
              variant="ghost"
              loading={busy}
              onClick={async () => {
                if (!window.confirm("Cancel this interview?")) return;
                setBusy(true);
                try {
                  onChange(await api<CandidateDetail>("PATCH", `/recruitment/interviews/${i.id}`, { status: "CANCELLED" }));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>
      {i.status === "DONE" && !giving && (
        <div className="mt-2 rounded-xl bg-slate-50 p-3 text-sm">
          <p className="mb-1">
            <Stars value={i.rating} />
          </p>
          <p className="whitespace-pre-line text-slate-700">{i.feedback}</p>
        </div>
      )}
      {giving && <FeedbackForm i={i} onCancel={() => setGiving(false)} onDone={(c) => (onChange(c), setGiving(false))} />}
    </li>
  );
}

function FeedbackForm({ i, onCancel, onDone }: { i: InterviewItem; onCancel: () => void; onDone: (c: CandidateDetail) => void }) {
  const [rating, setRating] = useState<number | null>(i.rating);
  const [recommendation, setRecommendation] = useState(i.recommendation ?? "");
  const [feedback, setFeedback] = useState(i.feedback ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-3 space-y-3 rounded-xl bg-slate-50 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!rating || !recommendation) return setError("Give a rating and a recommendation");
        setBusy(true);
        setError(null);
        try {
          onDone(await api<CandidateDetail>("POST", `/recruitment/interviews/${i.id}/feedback`, { rating, recommendation, feedback }));
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not save");
          setBusy(false);
        }
      }}
    >
      {error && <Alert>{error}</Alert>}
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <p className="mb-1 text-sm font-medium text-slate-700">Rating</p>
          <RatingPicker label="Interview rating" value={rating} onChange={setRating} />
        </div>
        <Field label="Recommendation">
          <Select value={recommendation} onChange={(e) => setRecommendation(e.target.value as typeof recommendation)} required>
            <option value="">Choose…</option>
            <option value="HIRE">Hire</option>
            <option value="MAYBE">Maybe</option>
            <option value="NO_HIRE">Don&apos;t hire</option>
          </Select>
        </Field>
      </div>
      <Field label="Feedback">
        <Textarea required minLength={2} rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Strengths, concerns, anything HR should know" />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" loading={busy}>
          Save feedback
        </Button>
      </div>
    </form>
  );
}

function ScheduleModal({ c, onClose, onDone }: { c: CandidateDetail; onClose: () => void; onDone: (c: CandidateDetail) => void }) {
  const people = useApi<Paginated<Employee>>("/employees?pageSize=100&status=ACTIVE");
  const [form, setForm] = useState({ date: "", time: "11:00", durationMinutes: "30", mode: "IN_PERSON", location: "", interviewerEmployeeId: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal open onClose={onClose} title={`Interview ${c.firstName}`}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            onDone(
              await api<CandidateDetail>("POST", `/recruitment/applications/${c.id}/interviews`, {
                // The browser's local time, sent as an exact moment.
                scheduledAt: new Date(`${form.date}T${form.time}`).toISOString(),
                durationMinutes: Number(form.durationMinutes),
                mode: form.mode,
                location: form.location.trim() || null,
                interviewerEmployeeId: form.interviewerEmployeeId || null,
              }),
            );
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not schedule");
            setBusy(false);
          }
        }}
      >
        {error && <Alert>{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date">
            <Input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Time">
            <Input type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
          </Field>
          <Field label="Length">
            <Select value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}>
              {[15, 30, 45, 60, 90].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="How">
            <Select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
              <option value="IN_PERSON">In person</option>
              <option value="VIDEO">Video call</option>
              <option value="PHONE">Phone</option>
            </Select>
          </Field>
          <Field label="Interviewer">
            <Select value={form.interviewerEmployeeId} onChange={(e) => setForm({ ...form, interviewerEmployeeId: e.target.value })}>
              <option value="">HR (me)</option>
              {people.data?.items.map((p) => (
                <option key={p.id} value={p.id}>
                  {fullName(p)} · {p.designation}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label={form.mode === "VIDEO" ? "Meeting link" : form.mode === "PHONE" ? "Notes (optional)" : "Where"}>
          <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder={form.mode === "VIDEO" ? "https://meet.google.com/…" : "Head office, 2nd floor"} />
        </Field>
        <p className="text-xs text-slate-500">The interviewer sees this under Recruitment → My interviews and gives feedback there.</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Schedule
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// --- Offer ---------------------------------------------------------------------

function Offer({ c, onChange }: { c: CandidateDetail; onChange: (c: CandidateDetail) => void }) {
  const { me } = useAuth();
  const [editing, setEditing] = useState(!c.offer);
  const [form, setForm] = useState({
    designation: c.offer?.designation ?? c.job.title,
    salary: c.offer ? String(c.offer.salary) : c.expectedSalary ? String(c.expectedSalary) : "",
    joiningDate: toDateInput(c.offer?.joiningDate),
    notes: c.offer?.notes ?? "",
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const o = c.offer;
  const closed = c.stage === "HIRED" || c.stage === "REJECTED";

  async function run(name: string, fn: () => Promise<CandidateDetail>) {
    setBusy(name);
    setError(null);
    try {
      onChange(await fn());
      if (name === "save") setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card title="Offer" actions={o && <OfferBadge status={o.status} />}>
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {editing && !closed ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run("save", () =>
              api("PUT", `/recruitment/applications/${c.id}/offer`, {
                designation: form.designation.trim(),
                salary: Number(form.salary),
                joiningDate: form.joiningDate,
                notes: form.notes.trim() || null,
              }),
            );
          }}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Job title">
              <Input required minLength={2} value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
            </Field>
            <Field label={`Monthly basic salary (${me?.organization.currency ?? "PKR"})`}>
              <Input required type="number" min={1} value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} />
            </Field>
            <Field label="Joining date">
              <Input required type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} />
            </Field>
          </div>
          <Field label="Other terms (optional)" hint="Printed on the offer letter">
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. Three months probation. Fuel allowance PKR 10,000." />
          </Field>
          <div className="flex justify-end gap-2">
            {o && (
              <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
            <Button type="submit" loading={busy === "save"}>
              {o ? "Save offer" : "Make offer"}
            </Button>
          </div>
        </form>
      ) : o ? (
        <div className="space-y-4">
          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-slate-500">Job title</dt>
              <dd className="font-medium text-slate-900">{o.designation}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Monthly basic salary</dt>
              <dd className="font-medium text-slate-900">{formatMoney(o.salary, me?.organization.currency)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Joining date</dt>
              <dd className="font-medium text-slate-900">{formatDate(o.joiningDate)}</dd>
            </div>
          </dl>
          {o.notes && <p className="whitespace-pre-line text-sm text-slate-700">{o.notes}</p>}
          {o.sentAt && <p className="text-xs text-slate-500">Sent on {formatDate(o.sentAt)}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                downloadFile(`/recruitment/applications/${c.id}/offer-letter`, `Offer letter - ${fullName(c)}.pdf`).catch((e) => setError(e.message))
              }
            >
              Download offer letter
            </Button>
            {!closed && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                  Change offer
                </Button>
                {o.status === "DRAFT" && (
                  <Button size="sm" loading={busy === "SENT"} onClick={() => run("SENT", () => api("POST", `/recruitment/applications/${c.id}/offer/status`, { status: "SENT" }))}>
                    Mark as sent
                  </Button>
                )}
                {(o.status === "SENT" || o.status === "DRAFT") && (
                  <>
                    <Button size="sm" variant="secondary" loading={busy === "ACCEPTED"} onClick={() => run("ACCEPTED", () => api("POST", `/recruitment/applications/${c.id}/offer/status`, { status: "ACCEPTED" }))}>
                      Accepted
                    </Button>
                    <Button size="sm" variant="secondary" loading={busy === "DECLINED"} onClick={() => run("DECLINED", () => api("POST", `/recruitment/applications/${c.id}/offer/status`, { status: "DECLINED" }))}>
                      Declined
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
          {o.status === "DECLINED" && !closed && <p className="text-sm text-slate-600">Change the offer to make a new one, or mark the candidate as not selected.</p>}
          {o.status === "ACCEPTED" && c.can.hire && <p className="text-sm text-slate-600">Offer accepted — use Hire above to add them as an employee.</p>}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No offer yet.</p>
      )}
    </Card>
  );
}

function OfferBadge({ status }: { status: NonNullable<CandidateDetail["offer"]>["status"] }) {
  const map = { DRAFT: ["gray", "Not sent yet"], SENT: ["blue", "Sent"], ACCEPTED: ["green", "Accepted"], DECLINED: ["red", "Declined"] } as const;
  return <Badge tone={map[status][0]}>{map[status][1]}</Badge>;
}
