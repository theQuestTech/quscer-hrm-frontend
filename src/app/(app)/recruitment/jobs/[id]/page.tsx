"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { formatDate, fullName } from "@/lib/format";
import type { ApplicationStage, CandidateListItem, JobDetail, JobStatus } from "@/lib/types";
import { Alert, Button, Card, Field, Input, Modal, PageHeader, Select, Spinner, Textarea } from "@/components/ui";
import {
  CandidateStageBadge, EMPLOYMENT_LABEL, JobFormModal, JobStatusBadge, SOURCE_LABEL, STAGE_LABEL, Stars, careersUrl,
} from "@/components/recruitment";

const BOARD: ApplicationStage[] = ["APPLIED", "SCREENING", "INTERVIEW", "OFFER", "HIRED"];

export default function JobPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const job = useApi<JobDetail>(`/recruitment/jobs/${id}`);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRejected, setShowRejected] = useState(false);

  if (job.loading && !job.data) return <Spinner />;
  if (job.error) return <Alert>{job.error}</Alert>;
  const j = job.data;
  if (!j) return null;

  async function setStatus(status: JobStatus) {
    setBusy(status);
    setError(null);
    try {
      await api("PATCH", `/recruitment/jobs/${id}`, { status });
      await job.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this job?")) return;
    setBusy("delete");
    try {
      await api("DELETE", `/recruitment/jobs/${id}`);
      router.push("/recruitment");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
      setBusy(null);
    }
  }

  const byStage = (s: ApplicationStage) => j.applications.filter((a) => a.stage === s);
  const rejected = byStage("REJECTED");
  const url = j.careersSlug ? `${careersUrl(j.careersSlug)}/jobs/${j.id}` : null;

  return (
    <>
      <Link href="/recruitment" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="size-4" /> Recruitment
      </Link>
      <PageHeader
        title={j.title}
        description={[j.department, j.location, j.employmentType && EMPLOYMENT_LABEL[j.employmentType]].filter(Boolean).join(" · ")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <JobStatusBadge status={j.status} />
            {j.canManage && (
              <>
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  Edit
                </Button>
                {j.status !== "OPEN" && (
                  <Button onClick={() => setStatus("OPEN")} loading={busy === "OPEN"}>
                    {j.status === "DRAFT" ? "Publish on careers page" : "Reopen"}
                  </Button>
                )}
                {j.status === "OPEN" && (
                  <Button variant="secondary" onClick={() => setStatus("CLOSED")} loading={busy === "CLOSED"}>
                    Close job
                  </Button>
                )}
                {j.applications.length === 0 && (
                  <Button variant="ghost" onClick={remove} loading={busy === "delete"}>
                    Delete
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {j.status === "OPEN" && url && (
        <div className="mb-6">
          <Alert tone="info">
            This job is live at{" "}
            <a href={url} target="_blank" rel="noreferrer" className="font-medium underline">
              {url}
            </a>
            {j.closesAt && ` until ${formatDate(j.closesAt)}`}.
          </Alert>
        </div>
      )}
      {j.status === "DRAFT" && j.canManage && (
        <div className="mb-6">
          <Alert tone="info">This job is a draft. Publish it to show it on your careers page.</Alert>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[#1a1a2e]">
          Candidates <span className="text-sm font-normal text-slate-500">· {j.applications.length} total, hired {byStage("HIRED").length} of {j.openings}</span>
        </h2>
        {j.canManage && (
          <Button size="sm" onClick={() => setAdding(true)}>
            Add candidate
          </Button>
        )}
      </div>
      <div className="mb-6 grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {BOARD.map((s) => (
          <section key={s} aria-label={STAGE_LABEL[s]} className="min-w-0 rounded-2xl bg-slate-100/70 p-3">
            <h3 className="mb-3 flex items-center justify-between px-1 text-sm font-semibold text-slate-700">
              {STAGE_LABEL[s]}
              <span className="rounded-full bg-white px-2 text-xs text-slate-500">{byStage(s).length}</span>
            </h3>
            <div className="space-y-2">
              {byStage(s).map((c) => (
                <CandidateCard key={c.id} c={c} />
              ))}
              {byStage(s).length === 0 && <p className="px-1 py-2 text-xs text-slate-400">No one here</p>}
            </div>
          </section>
        ))}
      </div>
      {rejected.length > 0 && (
        <div className="mb-6">
          <button type="button" className="text-sm font-medium text-slate-600 hover:underline" onClick={() => setShowRejected(!showRejected)} aria-expanded={showRejected}>
            {showRejected ? "Hide" : "Show"} {rejected.length} not selected
          </button>
          {showRejected && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {rejected.map((c) => (
                <CandidateCard key={c.id} c={c} />
              ))}
            </div>
          )}
        </div>
      )}

      <Card title="Job details">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-700">About the job</h3>
              <p className="whitespace-pre-line text-sm text-slate-700">{j.description}</p>
            </div>
            {j.requirements && (
              <div>
                <h3 className="mb-1 text-sm font-semibold text-slate-700">What we&apos;re looking for</h3>
                <p className="whitespace-pre-line text-sm text-slate-700">{j.requirements}</p>
              </div>
            )}
          </div>
          <dl className="space-y-3 text-sm">
            <Detail label="Salary" value={j.salaryRange} />
            <Detail label="People needed" value={String(j.openings)} />
            <Detail label="Applications close" value={j.closesAt ? formatDate(j.closesAt) : "No closing date"} />
            <Detail label="Hiring manager" value={j.hiringManager ? fullName(j.hiringManager) : null} />
            <Detail label="Created" value={formatDate(j.createdAt)} />
          </dl>
        </div>
      </Card>

      {editing && (
        <JobFormModal
          open
          job={j}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            job.reload();
          }}
        />
      )}
      {adding && (
        <AddCandidate
          jobId={j.id}
          onClose={() => setAdding(false)}
          onAdded={(appId) => router.push(`/recruitment/candidates/${appId}`)}
        />
      )}
    </>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-slate-900">{value || "—"}</dd>
    </div>
  );
}

function CandidateCard({ c }: { c: CandidateListItem }) {
  return (
    <Link
      href={`/recruitment/candidates/${c.id}`}
      className="block rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200 transition hover:ring-[#00857a]"
    >
      <p className="truncate text-sm font-medium text-slate-900">{fullName(c)}</p>
      <p className="truncate text-xs text-slate-500">
        {c.city ? `${c.city} · ` : ""}
        {SOURCE_LABEL[c.source] ?? c.source}
      </p>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>{formatDate(c.createdAt)}</span>
        {c.stage === "REJECTED" ? <CandidateStageBadge stage={c.stage} /> : <Stars value={c.averageRating} />}
      </div>
    </Link>
  );
}

function AddCandidate({ jobId, onClose, onAdded }: { jobId: string; onClose: () => void; onAdded: (id: string) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const data = new FormData(e.currentTarget);
    data.set("jobId", jobId);
    for (const key of ["expectedSalary", "noticePeriodDays", "city", "currentCompany", "coverNote"]) {
      if (!String(data.get(key) ?? "").trim()) data.delete(key);
    }
    const cv = data.get("cv");
    if (cv instanceof File && cv.size === 0) data.delete("cv");
    try {
      const app = await api<{ id: string }>("POST", "/recruitment/applications", data);
      onAdded(app.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add");
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Add candidate" wide>
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name">
            <Input name="firstName" required />
          </Field>
          <Field label="Last name">
            <Input name="lastName" required />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" required />
          </Field>
          <Field label="Phone">
            <Input name="phone" required placeholder="0300 1234567" />
          </Field>
          <Field label="City">
            <Input name="city" />
          </Field>
          <Field label="How they came to us">
            <Select name="source" defaultValue="REFERRAL">
              {["REFERRAL", "JOB_BOARD", "WALK_IN", "EMAIL", "OTHER"].map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Expected salary (optional)">
            <Input name="expectedSalary" type="number" min={0} />
          </Field>
          <Field label="CV (PDF or Word, optional)">
            <Input name="cv" type="file" accept=".pdf,.doc,.docx" />
          </Field>
        </div>
        <Field label="Notes from the referral (optional)">
          <Textarea name="coverNote" rows={3} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Add candidate
          </Button>
        </div>
      </form>
    </Modal>
  );
}
