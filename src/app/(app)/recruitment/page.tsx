"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { formatDate, formatTime, fullName } from "@/lib/format";
import type { ApplicationStage, CandidateListItem, InterviewItem, JobSummary } from "@/lib/types";
import { Alert, Button, Card, EmptyState, Input, PageHeader, Select, Spinner, Table, Tabs, Td, Th } from "@/components/ui";
import {
  CandidateStageBadge, JobFormModal, JobStatusBadge, RECOMMENDATION_LABEL, STAGES, STAGE_LABEL, SOURCE_LABEL, Stars, careersUrl,
} from "@/components/recruitment";

type Tab = "jobs" | "candidates" | "interviews" | "mine";

export default function RecruitmentPage() {
  const { me, can } = useAuth();
  const isHr = can("hrm.employee.write") || can("hrm.settings.write");
  const tabs: { id: Tab; label: string }[] = isHr
    ? [
        { id: "jobs", label: "Jobs" },
        { id: "candidates", label: "Candidates" },
        { id: "interviews", label: "Upcoming interviews" },
        ...(me?.employee ? [{ id: "mine" as Tab, label: "My interviews" }] : []),
      ]
    : [
        { id: "mine", label: "My interviews" },
        { id: "jobs", label: "My jobs" },
      ];
  const [tab, setTab] = useState<Tab>(tabs[0].id);

  if (!me?.organization.modules.includes("recruitment")) {
    return <Alert tone="info">Recruitment isn&apos;t turned on for this company. HR can turn it on in Settings.</Alert>;
  }
  return (
    <>
      <PageHeader title="Recruitment" description="Job openings, candidates and interviews" />
      {isHr && <CareersLink />}
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "jobs" && <Jobs isHr={isHr} />}
      {tab === "candidates" && <Candidates />}
      {tab === "interviews" && <Interviews scope="all" />}
      {tab === "mine" && <Interviews scope="mine" />}
    </>
  );
}

function CareersLink() {
  const link = useApi<{ slug: string }>("/recruitment/careers-link");
  const [copied, setCopied] = useState(false);
  if (!link.data) return null;
  const url = careersUrl(link.data.slug);
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#e8faf8] px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#1a1a2e]">Your careers page</p>
        <p className="truncate text-sm text-[#00857a]">
          <a href={url} target="_blank" rel="noreferrer" className="hover:underline">
            {url}
          </a>
        </p>
        <p className="text-xs text-slate-500">Share it on LinkedIn, WhatsApp or your website. Open jobs appear there and people apply with their CV.</p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            window.prompt("Copy this link", url);
          }
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}

function Jobs({ isHr }: { isHr: boolean }) {
  const router = useRouter();
  const jobs = useApi<JobSummary[]>("/recruitment/jobs");
  const [creating, setCreating] = useState(false);

  return (
    <Card
      title="Job openings"
      padded={false}
      actions={
        isHr && (
          <Button size="sm" onClick={() => setCreating(true)}>
            New job
          </Button>
        )
      }
    >
      {jobs.loading && !jobs.data ? (
        <Spinner />
      ) : jobs.error ? (
        <div className="p-4">
          <Alert>{jobs.error}</Alert>
        </div>
      ) : !jobs.data?.length ? (
        <EmptyState
          title={isHr ? "No jobs yet" : "No jobs assigned to you"}
          description={isHr ? "Create a job, then publish it to your careers page." : "When HR makes you the hiring manager for a job, it shows up here."}
        />
      ) : (
        <Table>
          <thead className="bg-slate-50">
            <tr>
              <Th>Job</Th>
              <Th>Status</Th>
              <Th>Candidates</Th>
              <Th>In progress</Th>
              <Th>Hired</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {jobs.data.map((j) => (
              <tr key={j.id}>
                <Td>
                  <p className="font-medium text-slate-900">{j.title}</p>
                  <p className="text-xs text-slate-500">{[j.department, j.location].filter(Boolean).join(" · ") || "—"}</p>
                </Td>
                <Td>
                  <JobStatusBadge status={j.status} />
                  {j.closesAt && j.status === "OPEN" && <p className="mt-1 text-xs text-slate-500">Closes {formatDate(j.closesAt)}</p>}
                </Td>
                <Td>
                  {j.total}
                  {j.byStage.APPLIED > 0 && <span className="ml-1 text-xs font-medium text-[#00857a]">({j.byStage.APPLIED} new)</span>}
                </Td>
                <Td>{j.byStage.SCREENING + j.byStage.INTERVIEW + j.byStage.OFFER}</Td>
                <Td>
                  {j.hired} of {j.openings}
                </Td>
                <Td className="text-right">
                  <Link href={`/recruitment/jobs/${j.id}`} className="text-sm font-medium text-[#00857a] hover:underline">
                    Open
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {creating && (
        <JobFormModal open onClose={() => setCreating(false)} onSaved={(j) => router.push(`/recruitment/jobs/${j.id}`)} />
      )}
    </Card>
  );
}

function Candidates() {
  const [stage, setStage] = useState<ApplicationStage | "">("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  const params = new URLSearchParams();
  if (stage) params.set("stage", stage);
  if (query) params.set("search", query);
  const list = useApi<CandidateListItem[]>(`/recruitment/applications?${params}`);

  return (
    <Card padded={false}>
      <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
        <div className="min-w-56 flex-1">
          <label htmlFor="cand-search" className="sr-only">
            Search candidates
          </label>
          <Input id="cand-search" placeholder="Search by name, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div>
          <label htmlFor="cand-stage" className="sr-only">
            Stage
          </label>
          <Select id="cand-stage" value={stage} onChange={(e) => setStage(e.target.value as ApplicationStage | "")}>
            <option value="">All stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {list.loading && !list.data ? (
        <Spinner />
      ) : list.error ? (
        <div className="p-4">
          <Alert>{list.error}</Alert>
        </div>
      ) : !list.data?.length ? (
        <EmptyState title="No candidates found" description="People who apply on your careers page show up here." />
      ) : (
        <Table>
          <thead className="bg-slate-50">
            <tr>
              <Th>Candidate</Th>
              <Th>Job</Th>
              <Th>Stage</Th>
              <Th>Rating</Th>
              <Th>Applied</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.data.map((c) => (
              <tr key={c.id}>
                <Td>
                  <p className="font-medium text-slate-900">{fullName(c)}</p>
                  <p className="text-xs text-slate-500">
                    {c.phone} · {SOURCE_LABEL[c.source] ?? c.source}
                  </p>
                </Td>
                <Td>{c.job?.title}</Td>
                <Td>
                  <CandidateStageBadge stage={c.stage} />
                </Td>
                <Td>
                  <Stars value={c.averageRating} />
                </Td>
                <Td>{formatDate(c.createdAt)}</Td>
                <Td className="text-right">
                  <Link href={`/recruitment/candidates/${c.id}`} className="text-sm font-medium text-[#00857a] hover:underline">
                    Open
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

function Interviews({ scope }: { scope: "mine" | "all" }) {
  const list = useApi<InterviewItem[]>(`/recruitment/interviews?scope=${scope}`);
  if (list.loading && !list.data) return <Spinner />;
  if (list.error) return <Alert>{list.error}</Alert>;
  if (!list.data?.length) {
    return (
      <Card>
        <EmptyState
          title={scope === "mine" ? "No interviews for you" : "No upcoming interviews"}
          description={scope === "mine" ? "When HR asks you to interview someone, it shows up here." : "Schedule interviews from a candidate's page."}
        />
      </Card>
    );
  }
  return (
    <Card padded={false}>
      <Table>
        <thead className="bg-slate-50">
          <tr>
            <Th>When</Th>
            <Th>Candidate</Th>
            <Th>How</Th>
            {scope === "all" ? <Th>Interviewer</Th> : <Th>Your feedback</Th>}
            <Th />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {list.data.map((i) => (
            <tr key={i.id}>
              <Td>
                <p className="font-medium text-slate-900">{formatDate(i.scheduledAt)}</p>
                <p className="text-xs text-slate-500">
                  {formatTime(i.scheduledAt)} · {i.durationMinutes} min
                </p>
              </Td>
              <Td>
                <p className="font-medium text-slate-900">{i.application && fullName(i.application)}</p>
                <p className="text-xs text-slate-500">{i.application?.job.title}</p>
              </Td>
              <Td>
                {i.mode === "VIDEO" ? "Video call" : i.mode === "PHONE" ? "Phone" : "In person"}
                {i.location && <p className="max-w-56 truncate text-xs text-slate-500">{i.location}</p>}
              </Td>
              <Td>
                {scope === "all" ? (
                  i.interviewer ? fullName(i.interviewer) : <span className="text-slate-400">Not set</span>
                ) : i.status === "DONE" ? (
                  <span>
                    <Stars value={i.rating} /> · {i.recommendation && RECOMMENDATION_LABEL[i.recommendation]}
                  </span>
                ) : (
                  <span className="text-amber-700">Waiting</span>
                )}
              </Td>
              <Td className="text-right">
                <Link href={`/recruitment/candidates/${i.applicationId}`} className="text-sm font-medium text-[#00857a] hover:underline">
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
