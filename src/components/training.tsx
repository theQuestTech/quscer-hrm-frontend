"use client";

import { useState } from "react";
import { api, downloadFile } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/format";
import type { CertificateState, TrainingCourse, TrainingDelivery, TrainingOverview, TrainingRecord, TrainingRequestStatus } from "@/lib/types";
import { Alert, Badge, type BadgeTone, Button, Card, EmptyState, Field, Modal, Select, Stat, Table, Td, Textarea, Th, Input } from "./ui";
import { RatingPicker } from "./performance";

export const DELIVERY_LABEL: Record<TrainingDelivery, string> = { CLASSROOM: "Classroom", ONLINE: "Online", ON_THE_JOB: "On the job" };

const CERT: Record<Exclude<CertificateState, "NONE">, [BadgeTone, string]> = {
  VALID: ["green", "Valid"],
  EXPIRING: ["yellow", "Expires soon"],
  EXPIRED: ["red", "Expired"],
};

export function CertificateBadge({ state }: { state?: CertificateState }) {
  if (!state || state === "NONE") return null;
  const [tone, label] = CERT[state];
  return <Badge tone={tone}>{label}</Badge>;
}

const REQUEST: Record<TrainingRequestStatus, [BadgeTone, string]> = {
  PENDING: ["yellow", "Waiting for a decision"],
  APPROVED: ["blue", "Approved — HR will book it"],
  REJECTED: ["red", "Not approved"],
  BOOKED: ["green", "Booked"],
};

export function RequestBadge({ status }: { status: TrainingRequestStatus }) {
  const [tone, label] = REQUEST[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function hoursText(h: number | null | undefined) {
  if (!h) return "—";
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
}

export function sessionWhen(s: { startsAt: string; endsAt: string }) {
  return `${formatDate(s.startsAt)}, ${formatTime(s.startsAt)}–${formatTime(s.endsAt)}`;
}

function downloadCertificate(r: TrainingRecord, onError: (e: string) => void) {
  downloadFile(`/training/enrolments/${r.id}/certificate`, `Certificate - ${r.course.title}.pdf`).catch((e) => onError(e.message));
}

// Someone's training: hours, upcoming sessions, certificates and history.
// Used for "My training" and for a person's page (HR / their manager).
export function TrainingOverviewView({ data, onChange, self }: { data: TrainingOverview; onChange: () => void; self: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState<TrainingRecord | null>(null);
  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Training hours this year" value={hoursText(data.hoursThisYear) === "—" ? "0 h" : hoursText(data.hoursThisYear)} />
        <Stat label="Courses completed" value={data.completedCount} />
        <Stat label="Coming up" value={data.upcoming.length} />
      </div>
      <Card title="Coming up" padded={false}>
        {data.upcoming.length === 0 ? (
          <EmptyState title="Nothing booked" description={self ? "When HR books you on a training session it shows up here." : undefined} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.upcoming.map((r) => (
              <li key={r.id} className="px-5 py-4">
                <p className="font-medium text-slate-900">{r.course.title}</p>
                <p className="text-sm text-slate-500">
                  {r.session && sessionWhen(r.session)}
                  {r.session?.location && (
                    <>
                      {" · "}
                      {/^https?:\/\//.test(r.session.location) ? (
                        <a href={r.session.location} target="_blank" rel="noreferrer" className="text-[#00857a] hover:underline">
                          Join link
                        </a>
                      ) : (
                        r.session.location
                      )}
                    </>
                  )}
                  {r.session?.trainer && ` · ${r.session.trainer}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {data.certificates.length > 0 && (
        <Card title="Certificates" padded={false}>
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <Th>Course</Th>
                <Th>Completed</Th>
                <Th>Valid until</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.certificates.map((r) => (
                <tr key={r.id}>
                  <Td className="font-medium text-slate-900">{r.course.title}</Td>
                  <Td>{formatDate(r.completedAt)}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      {formatDate(r.certificateExpiresAt)} <CertificateBadge state={r.certificate} />
                    </div>
                  </Td>
                  <Td className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => downloadCertificate(r, setError)}>
                      Certificate
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
      <Card title="Training history" padded={false}>
        {data.history.length === 0 ? (
          <EmptyState title="No training yet" />
        ) : (
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <Th>Course</Th>
                <Th>Date</Th>
                <Th>Hours</Th>
                <Th>Result</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.history.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <p className="font-medium text-slate-900">{r.course.title}</p>
                    <p className="text-xs text-slate-500">{r.session ? DELIVERY_LABEL[r.course.delivery] : "Done elsewhere"}</p>
                  </Td>
                  <Td>{formatDate(r.completedAt ?? r.session?.startsAt)}</Td>
                  <Td>{hoursText(r.hours)}</Td>
                  <Td>
                    {r.status === "NO_SHOW" ? (
                      <Badge tone="red">Didn&apos;t attend</Badge>
                    ) : (
                      <span className="text-sm text-slate-700">
                        Completed{r.score !== null && ` · ${r.score}%`}
                        {r.feedbackRating && <span className="ml-1 text-amber-500">{"★".repeat(r.feedbackRating)}</span>}
                      </span>
                    )}
                  </Td>
                  <Td className="text-right">
                    {r.status === "COMPLETED" && (
                      <div className="flex justify-end gap-1">
                        {self && data.canGiveFeedback && !r.feedbackRating && r.sessionId && (
                          <Button size="sm" variant="secondary" onClick={() => setRating(r)}>
                            Rate it
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => downloadCertificate(r, setError)}>
                          Certificate
                        </Button>
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {rating && (
        <FeedbackModal
          record={rating}
          onClose={() => setRating(null)}
          onDone={() => {
            setRating(null);
            onChange();
          }}
        />
      )}
    </div>
  );
}

function FeedbackModal({ record, onClose, onDone }: { record: TrainingRecord; onClose: () => void; onDone: () => void }) {
  const [value, setValue] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal open onClose={onClose} title={`How was ${record.course.title}?`}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!value) return setError("Choose a rating");
          setBusy(true);
          try {
            await api("POST", `/training/enrolments/${record.id}/feedback`, { rating: value, comment: comment.trim() || null });
            onDone();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save");
            setBusy(false);
          }
        }}
      >
        {error && <Alert>{error}</Alert>}
        <RatingPicker label="Your rating" value={value} onChange={setValue} />
        <Field label="Comments (optional)">
          <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What was useful? What could be better?" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Send
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function AskTrainingModal({ courses, onClose, onDone }: { courses: TrainingCourse[]; onClose: () => void; onDone: () => void }) {
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal open onClose={onClose} title="Ask for training">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await api("POST", "/training/requests", courseId ? { courseId, reason } : { title: title.trim(), reason });
            onDone();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not send");
            setBusy(false);
          }
        }}
      >
        {error && <Alert>{error}</Alert>}
        <Field label="Course">
          <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">Something not on our list…</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        </Field>
        {!courseId && (
          <Field label="What training do you need?">
            <Input required minLength={2} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Advanced Excel, forklift licence" />
          </Field>
        )}
        <Field label="Why would it help you?">
          <Textarea required minLength={5} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <p className="text-xs text-slate-500">Your manager or HR will decide.</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Send request
          </Button>
        </div>
      </form>
    </Modal>
  );
}
