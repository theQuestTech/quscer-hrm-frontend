"use client";

import type { OnboardingAssignee } from "@/lib/types";
import { cx } from "./ui";

export const ASSIGNEE_LABEL: Record<OnboardingAssignee, string> = { HR: "HR", MANAGER: "Manager", EMPLOYEE: "New joiner" };

export function dueText(dueDays: number) {
  if (dueDays === 0) return "On joining day";
  const n = Math.abs(dueDays);
  return `${n} day${n === 1 ? "" : "s"} ${dueDays < 0 ? "before" : "after"} joining`;
}

// Today's date as yyyy-mm-dd in UTC, compared with due dates (stored at
// midnight UTC).
export function isOverdue(dueDate: string, doneAt: string | null) {
  return !doneAt && dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10);
}

export function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Checklist progress">
        <div className={cx("h-full rounded-full", pct === 100 ? "bg-emerald-500" : "bg-[#00b4a6]")} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-600">
        {done}/{total}
      </span>
    </div>
  );
}
