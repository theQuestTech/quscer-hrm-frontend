"use client";

import { formatRelative } from "@/lib/format";
import { Badge, type BadgeTone, cx } from "./ui";

export type HelpStatus = "OPEN" | "ANSWERED" | "CLOSED";

// The customer's words for where their question is.
const STATUS: Record<HelpStatus, [BadgeTone, string]> = {
  OPEN: ["yellow", "Waiting for Quscer"],
  ANSWERED: ["green", "Answered"],
  CLOSED: ["gray", "Closed"],
};

export function HelpStatusBadge({ status }: { status: HelpStatus }) {
  const [tone, label] = STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}

// One help-request conversation, used on "Get help" and in the support
// console. Messages are plain text; line breaks are kept.
export function Conversation({
  messages,
  mine,
}: {
  messages: { id: string; body: string; createdAt: string; fromSupport: boolean; author: string }[];
  // Which side is "us" (shown tinted): the customer's own messages, or support's.
  mine: "customer" | "support";
}) {
  return (
    <ul className="divide-y divide-gray-100">
      {messages.map((m) => {
        const ours = mine === "support" ? m.fromSupport : !m.fromSupport;
        return (
          <li key={m.id} className={cx("flex gap-3 px-5 py-4", ours && "bg-[#f0faf9]")}>
            <span
              aria-hidden
              className={cx(
                "grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold",
                m.fromSupport ? "bg-[#00857a] text-white" : "bg-slate-200 text-slate-700",
              )}
            >
              {m.fromSupport ? "Q" : m.author.split(" ").map((w) => w[0]).slice(0, 2).join("")}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1a1a2e]">
                {m.fromSupport ? `${m.author} · Quscer support` : m.author}
                <span className="ml-2 font-normal text-slate-400" title={new Date(m.createdAt).toLocaleString("en-GB")}>
                  {formatRelative(m.createdAt)}
                </span>
              </p>
              <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-slate-700">{m.body}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
