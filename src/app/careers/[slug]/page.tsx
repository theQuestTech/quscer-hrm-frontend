"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { publicApi } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { CompanyHeader, type PublicJob, jobFacts } from "@/components/careers";
import { Alert, Spinner } from "@/components/ui";

export default function CareersPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<{ company: string; jobs: PublicJob[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    publicApi<{ company: string; jobs: PublicJob[] }>("GET", `/careers/${encodeURIComponent(slug)}`)
      .then((d) => {
        setData(d);
        document.title = `Careers at ${d.company}`;
      })
      .catch((e) => setError(e.status === 404 ? "This careers page doesn't exist." : e.message));
  }, [slug]);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Spinner />;
  return (
    <>
      <CompanyHeader company={data.company} subtitle={data.jobs.length ? `${data.jobs.length} open position${data.jobs.length === 1 ? "" : "s"}` : "Careers"} />
      {data.jobs.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <p className="font-medium text-slate-900">No open positions right now</p>
          <p className="mt-1 text-sm text-slate-500">Please check back later.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {data.jobs.map((j) => (
            <li key={j.id}>
              <Link
                href={`/careers/${slug}/jobs/${j.id}`}
                className="block rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:ring-[#00857a]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold text-[#1a1a2e]">{j.title}</h2>
                    <p className="text-sm text-slate-500">{jobFacts(j) || " "}</p>
                  </div>
                  <span className="rounded-xl bg-[#00857a] px-3 py-1.5 text-sm font-medium text-white">View and apply</span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-slate-600">{j.description}</p>
                <p className="mt-3 text-xs text-slate-400">
                  Posted {formatDate(j.postedAt)}
                  {j.closesAt && ` · Apply by ${formatDate(j.closesAt)}`}
                  {j.salaryRange && ` · ${j.salaryRange}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
