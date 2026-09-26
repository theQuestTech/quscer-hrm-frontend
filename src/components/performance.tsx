"use client";

import type { ReviewStage } from "@/lib/types";
import { Badge, type BadgeTone, cx } from "./ui";

export const STAGE_LABEL: Record<ReviewStage, string> = {
  GOALS: "Setting goals",
  SELF: "Self-review",
  MANAGER: "Manager review",
  DONE: "Done",
};

const STAGE_TONE: Record<ReviewStage, BadgeTone> = { GOALS: "gray", SELF: "yellow", MANAGER: "blue", DONE: "green" };

export function StageBadge({ stage }: { stage: ReviewStage }) {
  return <Badge tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Badge>;
}

export function bandColor(score: number) {
  if (score >= 90) return "#047857";
  if (score >= 75) return "#00857a";
  if (score >= 60) return "#2563eb";
  if (score >= 40) return "#b45309";
  return "#b91c1c";
}

export function ScoreText({ score, band }: { score: number | null; band?: string | null }) {
  if (score === null) return <span className="text-gray-400">—</span>;
  return (
    <span className="font-semibold" style={{ color: bandColor(score) }}>
      {score}%{band && <span className="ml-1 font-normal text-gray-500">· {band}</span>}
    </span>
  );
}

// Goals → Self-review → Manager review → Done, with the current step lit.
export function StageSteps({ stage, selfReview }: { stage: ReviewStage; selfReview: boolean }) {
  const steps: ReviewStage[] = selfReview ? ["GOALS", "SELF", "MANAGER", "DONE"] : ["GOALS", "MANAGER", "DONE"];
  const at = steps.indexOf(stage === "SELF" && !selfReview ? "MANAGER" : stage);
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="Review progress">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span
            aria-current={i === at ? "step" : undefined}
            className={cx(
              "rounded-full px-3 py-1 text-xs font-semibold",
              i < at ? "bg-[#e8faf8] text-[#00857a]" : i === at ? "bg-[#00857a] text-white" : "bg-gray-100 text-gray-500",
            )}
          >
            {i < at ? "✓ " : ""}
            {STAGE_LABEL[s]}
          </span>
          {i < steps.length - 1 && <span className="text-gray-300">→</span>}
        </li>
      ))}
    </ol>
  );
}

// 1–5 rating buttons.
export function RatingPicker({
  value,
  onChange,
  label,
  disabled,
}: {
  value: number | null;
  onChange: (v: number) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} of 5`}
          disabled={disabled}
          onClick={() => onChange(n)}
          className={cx(
            "grid size-8 place-items-center rounded-lg text-sm font-semibold ring-1 ring-inset transition-colors",
            value !== null && n <= value ? "bg-[#00857a] text-white ring-[#00857a]" : "bg-white text-gray-500 ring-gray-200 hover:bg-gray-50",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
