"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { fullName, toDateInput } from "@/lib/format";
import type { ApplicationStage, Department, Employee, EmploymentType, Job, JobStatus, Paginated, Branch } from "@/lib/types";
import { Alert, Badge, type BadgeTone, Button, Field, Input, Modal, Select, Textarea } from "./ui";

export const STAGES: ApplicationStage[] = ["APPLIED", "SCREENING", "INTERVIEW", "OFFER", "HIRED", "REJECTED"];

export const STAGE_LABEL: Record<ApplicationStage, string> = {
  APPLIED: "New",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  HIRED: "Hired",
  REJECTED: "Not selected",
};

const STAGE_TONE: Record<ApplicationStage, BadgeTone> = {
  APPLIED: "gray",
  SCREENING: "yellow",
  INTERVIEW: "blue",
  OFFER: "blue",
  HIRED: "green",
  REJECTED: "red",
};

export function CandidateStageBadge({ stage }: { stage: ApplicationStage }) {
  return <Badge tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Badge>;
}

export const JOB_STATUS_LABEL: Record<JobStatus, string> = { DRAFT: "Draft", OPEN: "Open", CLOSED: "Closed" };

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <Badge tone={status === "OPEN" ? "green" : status === "DRAFT" ? "gray" : "red"}>{JOB_STATUS_LABEL[status]}</Badge>;
}

export const EMPLOYMENT_LABEL: Record<EmploymentType, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  INTERN: "Internship",
};

export const SOURCE_LABEL: Record<string, string> = {
  CAREERS_PAGE: "Careers page",
  REFERRAL: "Referral",
  JOB_BOARD: "Job board",
  WALK_IN: "Walk-in",
  EMAIL: "Email",
  OTHER: "Other",
};

export const RECOMMENDATION_LABEL = { HIRE: "Hire", MAYBE: "Maybe", NO_HIRE: "Don't hire" } as const;

export function Stars({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-400">—</span>;
  return (
    <span className="font-medium text-slate-900" aria-label={`${value} out of 5`}>
      <span className="text-amber-500" aria-hidden>
        ★
      </span>{" "}
      {value}
    </span>
  );
}

export function careersUrl(slug: string) {
  return `${typeof window !== "undefined" ? window.location.origin : ""}/careers/${slug}`;
}

// Create or edit a job opening.
export function JobFormModal({
  open,
  onClose,
  job,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  job?: Job;
  onSaved: (job: { id: string }) => void;
}) {
  const departments = useApi<Department[]>(open ? "/departments" : null);
  const branches = useApi<Branch[]>(open ? "/branches" : null);
  const people = useApi<Paginated<Employee>>(open ? "/employees?pageSize=100&status=ACTIVE" : null);
  const [form, setForm] = useState(() => ({
    title: job?.title ?? "",
    departmentId: job?.departmentId ?? "",
    branchId: job?.branchId ?? "",
    employmentType: job?.employmentType ?? "FULL_TIME",
    location: job?.location ?? "",
    salaryRange: job?.salaryRange ?? "",
    openings: String(job?.openings ?? 1),
    closesAt: toDateInput(job?.closesAt),
    hiringManagerEmployeeId: job?.hiringManagerEmployeeId ?? "",
    description: job?.description ?? "",
    requirements: job?.requirements ?? "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = {
      title: form.title.trim(),
      departmentId: form.departmentId || null,
      branchId: form.branchId || null,
      employmentType: form.employmentType || null,
      location: form.location.trim() || null,
      salaryRange: form.salaryRange.trim() || null,
      openings: Number(form.openings) || 1,
      closesAt: form.closesAt || null,
      hiringManagerEmployeeId: form.hiringManagerEmployeeId || null,
      description: form.description.trim(),
      requirements: form.requirements.trim() || null,
    };
    try {
      const saved = job
        ? await api<{ id: string }>("PATCH", `/recruitment/jobs/${job.id}`, body)
        : await api<{ id: string }>("POST", "/recruitment/jobs", body);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={job ? "Edit job" : "New job opening"} wide>
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Job title">
          <Input required minLength={2} value={form.title} onChange={set("title")} placeholder="Sales Executive" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Department">
            <Select value={form.departmentId} onChange={set("departmentId")}>
              <option value="">—</option>
              {departments.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Branch">
            <Select value={form.branchId} onChange={set("branchId")}>
              <option value="">—</option>
              {branches.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Type">
            <Select value={form.employmentType} onChange={set("employmentType")}>
              {Object.entries(EMPLOYMENT_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Location" hint="Shown on the careers page">
            <Input value={form.location} onChange={set("location")} placeholder="Lahore" />
          </Field>
          <Field label="Salary (optional)" hint="Shown as written">
            <Input value={form.salaryRange} onChange={set("salaryRange")} placeholder="PKR 80,000 – 100,000" />
          </Field>
          <Field label="People needed">
            <Input type="number" min={1} max={500} value={form.openings} onChange={set("openings")} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Applications close (optional)">
            <Input type="date" value={form.closesAt} onChange={set("closesAt")} />
          </Field>
          <Field label="Hiring manager (optional)" hint="Can see this job's candidates">
            <Select value={form.hiringManagerEmployeeId} onChange={set("hiringManagerEmployeeId")}>
              <option value="">—</option>
              {people.data?.items.map((p) => (
                <option key={p.id} value={p.id}>
                  {fullName(p)} · {p.designation}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="About the job">
          <Textarea required minLength={10} rows={5} value={form.description} onChange={set("description")} placeholder="What the person will do day to day" />
        </Field>
        <Field label="What we're looking for (optional)">
          <Textarea rows={4} value={form.requirements} onChange={set("requirements")} placeholder="Experience, education, skills" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {job ? "Save" : "Save as draft"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
