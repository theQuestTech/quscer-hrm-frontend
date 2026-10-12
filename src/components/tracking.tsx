"use client";

import { useAuth } from "@/lib/auth";
import type { LiveStatus } from "@/lib/types";
import { Badge, type BadgeTone } from "./ui";

// Shared bits for the field tracking pages.

export const STATUS: Record<LiveStatus, { label: string; tone: BadgeTone; color: string; help: string }> = {
  LIVE: { label: "Live", tone: "green", color: "#059669", help: "Position arriving normally" },
  WAITING: { label: "Just checked in", tone: "blue", color: "#4f46e5", help: "First position on its way" },
  NO_SIGNAL: { label: "No signal", tone: "yellow", color: "#d97706", help: "Nothing heard for a while — phone off, no internet or battery saver" },
  LOCATION_OFF: { label: "Location off", tone: "red", color: "#dc2626", help: "They switched off location or took away permission" },
  NOT_CHECKED_IN: { label: "Off duty", tone: "gray", color: "#94a3b8", help: "Not checked in — not tracked" },
};

export function LiveBadge({ status }: { status: LiveStatus }) {
  return <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>;
}

// The add-on is switched on for this company.
export function useFieldTracking() {
  const { me } = useAuth();
  return !!me?.organization.fieldTracking;
}

export function NotSwitchedOn() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center">
      <p className="font-medium text-[#1a1a2e]">Field tracking isn&apos;t switched on for your company</p>
      <p className="mt-1 text-sm text-gray-500">It&apos;s an add-on. Ask Quscer support if you&apos;d like it.</p>
    </div>
  );
}

export function minutesSince(value: string, now = Date.now()) {
  return Math.max(0, Math.round((now - new Date(value).getTime()) / 60000));
}
