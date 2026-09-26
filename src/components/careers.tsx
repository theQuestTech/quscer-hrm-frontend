"use client";

import type { EmploymentType } from "@/lib/types";

export interface PublicJob {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  employmentType: EmploymentType | null;
  description: string;
  requirements: string | null;
  salaryRange: string | null;
  closesAt: string | null;
  postedAt: string;
}

const TYPE: Record<EmploymentType, string> = { FULL_TIME: "Full-time", PART_TIME: "Part-time", CONTRACT: "Contract", INTERN: "Internship" };

export function jobFacts(j: PublicJob) {
  return [j.department, j.location, j.employmentType && TYPE[j.employmentType]].filter(Boolean).join(" · ");
}

export function CompanyHeader({ company, subtitle }: { company: string; subtitle: string }) {
  return (
    <header className="mb-8">
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-[#00857a] text-xl font-bold text-white" aria-hidden>
        {company.trim().charAt(0).toUpperCase()}
      </div>
      <h1 className="text-3xl font-bold text-[#1a1a2e]" style={{ fontFamily: "var(--font-display)" }}>
        {company}
      </h1>
      <p className="mt-1 text-slate-500">{subtitle}</p>
    </header>
  );
}
