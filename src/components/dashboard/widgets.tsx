"use client";

// Dashboard pieces, copied from the Figma Make design (same classes,
// colours and sizes) and fed with real data. Photos in the design are
// shown as initials, since the app doesn't store photos.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import type { ActivityItem, AttendanceRecord, LeaveRequest, TodayCounts, TodayPerson, UpcomingLeaveItem } from "@/lib/types";
import { Icon } from "@/components/figma-icons";
import { initials } from "@/lib/format";
import { PersonAvatar, usePhoto } from "@/components/photo";

type IconName = Parameters<typeof Icon>[0]["name"];
const display = { fontFamily: "var(--font-display)" };

// --- Card + heading ----------------------------------------------------------

export function Panel({
  title,
  link,
  children,
  className = "",
}: {
  title: string;
  link?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-2xl border border-gray-100 bg-white p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#1a1a2e]" style={display}>
          {title}
        </h2>
        {link && (
          <Link href={link.href} className="flex items-center gap-0.5 text-xs font-medium text-[#00857a] hover:underline">
            {link.label} <Icon name="chevron-right" size={12} color="#00b4a6" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function greeting(hour: number) {
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export function GreetingBanner({ firstName, subtitle }: { firstName: string; subtitle: string }) {
  const now = new Date();
  const date = now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white px-7 py-5">
      <div className="pointer-events-none absolute right-0 top-0 h-full w-48 opacity-10" aria-hidden>
        <svg viewBox="0 0 200 120" className="h-full w-full">
          <circle cx="160" cy="20" r="60" fill="#00b4a6" />
          <circle cx="100" cy="80" r="40" fill="#34d399" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-[#1a1a2e]" style={display}>
        {greeting(now.getHours())}, {firstName}! 👋
      </h1>
      <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      <div className="mt-2 flex items-center gap-2 text-sm text-gray-500 sm:absolute sm:right-7 sm:top-5 sm:mt-0">
        <Icon name="calendar" size={15} color="#9ca3af" />
        <span>{date}</span>
      </div>
    </div>
  );
}

// --- Stat cards ---------------------------------------------------------------

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub: string;
  badge?: string | null;
  badgeColor?: string;
  icon: IconName;
  iconBg: string;
  iconColor: string;
  href?: string;
}

// The four cards across the top use these icon colours in the design.
export const STAT_TONES = {
  teal: { icon: "user" as IconName, iconBg: "#e8faf8", iconColor: "#00b4a6" },
  blue: { icon: "check-circle" as IconName, iconBg: "#eff6ff", iconColor: "#3b82f6" },
  purple: { icon: "calendar" as IconName, iconBg: "#f5f3ff", iconColor: "#8b5cf6" },
  amber: { icon: "doc" as IconName, iconBg: "#fff7ed", iconColor: "#f59e0b" },
};

export function StatCards({ cards }: { cards: StatCardProps[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {cards.map((s) => {
        const body = (
          <>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: s.iconBg }}>
              <Icon name={s.icon} size={20} color={s.iconColor} />
            </div>
            <div className="mb-1 text-xs text-gray-500">{s.label}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#1a1a2e]" style={display}>
                {s.value}
              </span>
              {s.badge && (
                <span className="text-xs font-semibold" style={{ color: s.badgeColor }}>
                  {s.badge}
                </span>
              )}
            </div>
            <div className="mt-1 text-xs text-gray-400">{s.sub}</div>
          </>
        );
        return s.href ? (
          <Link key={s.label} href={s.href} className="block rounded-2xl border border-gray-100 bg-white p-5 hover:border-gray-200">
            {body}
          </Link>
        ) : (
          <div key={s.label} className="rounded-2xl border border-gray-100 bg-white p-5">
            {body}
          </div>
        );
      })}
    </div>
  );
}

// --- Attendance donut ---------------------------------------------------------

function DonutChart({ pct }: { pct: number | null }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = ((pct ?? 0) / 100) * circ;
  return (
    <div className="relative flex flex-shrink-0 items-center justify-center" style={{ width: 130, height: 130 }}>
      <svg width="130" height="130" viewBox="0 0 130 130" aria-hidden>
        <circle cx="65" cy="65" r={r} fill="none" stroke="#e5e7eb" strokeWidth="14" />
        {pct !== null && pct > 0 && (
          <circle
            cx="65"
            cy="65"
            r={r}
            fill="none"
            stroke="url(#tealGrad)"
            strokeWidth="14"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={circ / 4}
            strokeLinecap="round"
          />
        )}
        <defs>
          <linearGradient id="tealGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00b4a6" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold text-gray-800" style={display}>
          {pct === null ? "—" : `${pct}%`}
        </div>
      </div>
    </div>
  );
}

export const STATUS_COLOR = {
  present: "#10b981",
  absent: "#ef4444",
  late: "#f59e0b",
  onLeave: "#8b5cf6",
};

export function AttendanceOverview({
  title,
  counts,
  link,
  rateLabel = "Attendance Rate",
}: {
  title: string;
  counts: Pick<TodayCounts, "present" | "absent" | "late" | "onLeave" | "attendanceRate">;
  link?: { href: string; label: string };
  rateLabel?: string;
}) {
  const rows = [
    { label: "Present", count: counts.present, color: STATUS_COLOR.present },
    { label: "Absent", count: counts.absent, color: STATUS_COLOR.absent },
    { label: "Late", count: counts.late, color: STATUS_COLOR.late },
    { label: "On Leave", count: counts.onLeave, color: STATUS_COLOR.onLeave },
  ];
  return (
    <Panel title={title} link={link}>
      <div className="flex items-center gap-5">
        <DonutChart pct={counts.attendanceRate} />
        <div className="space-y-2.5">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-2 text-sm">
              <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
              <span className="w-16 text-xs text-gray-500">{r.label}</span>
              <span className="text-xs font-semibold text-[#1a1a2e]">{r.count}</span>
            </div>
          ))}
          <div className="mt-1 text-[10px] text-gray-400">{rateLabel}</div>
        </div>
      </div>
    </Panel>
  );
}

// --- People -------------------------------------------------------------------

// Photo when the person has one, coloured initials otherwise.
export function Avatar({
  person,
  size = 32,
}: {
  person: { id?: string; firstName: string; lastName: string; photoUpdatedAt?: string | null };
  size?: number;
}) {
  return (
    <PersonAvatar
      person={person}
      photo={person.id && person.photoUpdatedAt ? { employeeId: person.id, updatedAt: person.photoUpdatedAt } : null}
      size={size}
    />
  );
}

function fmtDay(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

const LEAVE_PILL: Record<string, { label: string; style: React.CSSProperties }> = {
  APPROVED: { label: "Approved", style: { backgroundColor: "#d1fae5", color: "#047857" } },
  PENDING: { label: "Pending", style: { backgroundColor: "#fef3c7", color: "#b45309" } },
  FIRST_APPROVED: { label: "1st approval", style: { backgroundColor: "#e0f2fe", color: "#0369a1" } },
  REJECTED: { label: "Rejected", style: { backgroundColor: "#fee2e2", color: "#b91c1c" } },
  CANCELLED: { label: "Cancelled", style: { backgroundColor: "#f3f4f6", color: "#4b5563" } },
};

export function LeaveList({
  title,
  items,
  link,
  empty,
}: {
  title: string;
  items: UpcomingLeaveItem[];
  link?: { href: string; label: string };
  empty: string;
}) {
  return (
    <Panel title={title} link={link}>
      {items.length === 0 ? (
        <p className="py-6 text-center text-xs text-gray-400">{empty}</p>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 4).map((l) => (
            <div key={l.id} className="flex items-center gap-2.5">
              <Avatar person={l.employee} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-[#1a1a2e]">
                  {l.employee.firstName} {l.employee.lastName}
                </div>
                <div className="truncate text-[10px] text-gray-500">
                  {l.employee.designation} · {l.leaveType}
                </div>
                <div className="text-[10px] text-gray-500">
                  {fmtDay(l.startDate)}
                  {l.startDate !== l.endDate && ` – ${fmtDay(l.endDate)}`}
                </div>
              </div>
              <span
                className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={(LEAVE_PILL[l.status] ?? LEAVE_PILL.PENDING).style}
              >
                {(LEAVE_PILL[l.status] ?? LEAVE_PILL.PENDING).label}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// My own requests shaped like the "Upcoming Leave" list.
export function myLeaveItems(
  requests: LeaveRequest[] | null,
  me: { id: string; firstName: string; lastName: string; designation: string; employeeNumber: string },
): UpcomingLeaveItem[] {
  const today = new Date().toISOString().slice(0, 10);
  return (requests ?? [])
    .filter((r) => r.status !== "CANCELLED" && r.endDate.slice(0, 10) >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((r) => ({
      id: r.id,
      employee: me,
      leaveType: r.leaveType.name,
      startDate: r.startDate,
      endDate: r.endDate,
      days: r.days,
      status: r.status,
    }));
}

const TODAY_LABEL: Record<string, { label: string; color: string }> = {
  PRESENT: { label: "Present", color: "#059669" },
  LATE: { label: "Late", color: "#d97706" },
  HALF_DAY: { label: "Half day", color: "#d97706" },
  ABSENT: { label: "Absent", color: "#dc2626" },
  ON_LEAVE: { label: "On leave", color: "#7c3aed" },
  OFF: { label: "Day off", color: "#6b7280" },
  NOT_IN: { label: "Not in yet", color: "#6b7280" },
};

export function PeopleToday({
  title,
  people,
  link,
  empty,
}: {
  title: string;
  people: TodayPerson[];
  link?: { href: string; label: string };
  empty: string;
}) {
  return (
    <Panel title={title} link={link}>
      {people.length === 0 ? (
        <p className="py-6 text-center text-xs text-gray-400">{empty}</p>
      ) : (
        <div className="space-y-3">
          {people.slice(0, 5).map((t) => {
            const s = TODAY_LABEL[t.status] ?? TODAY_LABEL.NOT_IN;
            return (
              <div key={t.id} className="flex items-center gap-2.5">
                <Avatar person={t} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-[#1a1a2e]">
                    {t.firstName} {t.lastName}
                  </div>
                  <div className="truncate text-[10px] text-gray-500">{t.designation}</div>
                </div>
                <span className="flex flex-shrink-0 items-center gap-1 text-[10px] font-semibold" style={{ color: s.color }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// Who came in first, then who's missing — the most useful five to show.
export function highlightOrder(people: TodayPerson[]) {
  const rank: Record<string, number> = { LATE: 0, ABSENT: 1, PRESENT: 2, HALF_DAY: 2, ON_LEAVE: 3, NOT_IN: 4, OFF: 5 };
  return [...people].sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9));
}

// --- Quick stats --------------------------------------------------------------

export const QUICK_TONES = {
  blue: { icon: "calendar" as IconName, iconBg: "#eff6ff", iconColor: "#3b82f6" },
  amber: { icon: "clock" as IconName, iconBg: "#fff7ed", iconColor: "#f59e0b" },
  green: { icon: "pay" as IconName, iconBg: "#d1fae5", iconColor: "#10b981" },
  purple: { icon: "doc" as IconName, iconBg: "#f5f3ff", iconColor: "#8b5cf6" },
};

export function QuickStats({
  items,
  title = "Quick Stats",
}: {
  title?: string;
  items: { label: string; value: React.ReactNode; icon: IconName; iconBg: string; iconColor: string; href?: string }[];
}) {
  return (
    <Panel title={title}>
      <div className="space-y-3">
        {items.map((q) => {
          const inner = (
            <>
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: q.iconBg }}>
                <Icon name={q.icon} size={15} color={q.iconColor} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] leading-tight text-gray-500">{q.label}</div>
                <div className="text-sm font-bold text-[#1a1a2e]" style={display}>
                  {q.value}
                </div>
              </div>
            </>
          );
          return q.href ? (
            <Link key={q.label} href={q.href} className="flex items-center gap-3 rounded-lg hover:bg-[#f9fafb]">
              {inner}
            </Link>
          ) : (
            <div key={q.label} className="flex items-center gap-3">
              {inner}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// --- My attendance calendar ---------------------------------------------------

const DOT: Record<string, string> = {
  PRESENT: STATUS_COLOR.present,
  ABSENT: STATUS_COLOR.absent,
  LATE: STATUS_COLOR.late,
  HALF_DAY: STATUS_COLOR.late,
  ON_LEAVE: STATUS_COLOR.onLeave,
};

export function ym(d: Date) {
  return { y: d.getFullYear(), m: d.getMonth() };
}

// A manager's leave list also holds their team's requests, so only the
// person's own (employeeId) are used.
export function useMyMonth(month: { y: number; m: number }, employeeId: string | null) {
  const enabled = !!employeeId;
  const [records, setRecords] = useState<AttendanceRecord[] | null>(null);
  const [leave, setLeave] = useState<LeaveRequest[] | null>(null);
  const from = `${month.y}-${String(month.m + 1).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(month.y, month.m + 1, 0)).getUTCDate();
  const to = `${month.y}-${String(month.m + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const [r, l] = await Promise.all([
        api<AttendanceRecord[]>("GET", `/attendance?from=${from}&to=${to}`),
        api<LeaveRequest[]>("GET", `/leave-requests?status=APPROVED&employeeId=${employeeId}`),
      ]);
      setRecords(r);
      setLeave(l.filter((x) => x.employeeId === employeeId));
    } catch {
      setRecords([]);
      setLeave([]);
    }
  }, [enabled, employeeId, from, to]);

  useEffect(() => {
    load();
    window.addEventListener("hrm:attendance-changed", load);
    return () => window.removeEventListener("hrm:attendance-changed", load);
  }, [load]);

  // Status per day of the month (1-based); approved leave fills days with
  // no attendance record.
  const byDay = new Map<number, string>();
  for (const l of leave ?? []) {
    for (let d = 1; d <= last; d++) {
      const key = `${month.y}-${String(month.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (key >= l.startDate.slice(0, 10) && key <= l.endDate.slice(0, 10)) byDay.set(d, "ON_LEAVE");
    }
  }
  for (const r of records ?? []) byDay.set(Number(r.date.slice(8, 10)), r.status);

  const counts = { present: 0, absent: 0, late: 0, onLeave: 0 };
  for (const s of byDay.values()) {
    if (s === "PRESENT" || s === "HALF_DAY") counts.present += 1;
    else if (s === "LATE") {
      counts.present += 1;
      counts.late += 1;
    } else if (s === "ABSENT") counts.absent += 1;
    else if (s === "ON_LEAVE") counts.onLeave += 1;
  }
  const expected = counts.present + counts.absent;
  return {
    loaded: records !== null,
    byDay,
    counts: { ...counts, attendanceRate: expected > 0 ? Math.round((counts.present / expected) * 100) : null },
  };
}

export function AttendanceCalendar({ employeeId }: { employeeId: string }) {
  const now = new Date();
  const [month, setMonth] = useState(ym(now));
  const { byDay } = useMyMonth(month, employeeId);
  const first = new Date(month.y, month.m, 1);
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
  const prevDays = new Date(month.y, month.m, 0).getDate();
  const lead = first.getDay();
  const cells: { day: number; current: boolean }[] = [];
  for (let i = lead - 1; i >= 0; i--) cells.push({ day: prevDays - i, current: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, current: true });
  let n = 1;
  while (cells.length % 7 !== 0) cells.push({ day: n++, current: false });
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const isThisMonth = month.y === now.getFullYear() && month.m === now.getMonth();
  const label = first.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const shift = (delta: number) => {
    const d = new Date(month.y, month.m + delta, 1);
    setMonth(ym(d));
  };

  return (
    <Panel title="My Attendance" link={{ href: "/attendance", label: "View Details" }}>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="p-1 text-gray-400 transition-colors hover:text-gray-600">
          <Icon name="chevron-left" size={14} color="#9ca3af" />
        </button>
        <span className="text-xs font-semibold text-[#1a1a2e]">{label}</span>
        <button type="button" onClick={() => shift(1)} aria-label="Next month" className="p-1 text-gray-400 transition-colors hover:text-gray-600">
          <Icon name="chevron-right" size={14} color="#9ca3af" />
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1 text-center text-[10px] font-medium text-gray-400">
            {d}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {week.map((c, di) => {
            const isToday = c.current && isThisMonth && c.day === now.getDate();
            const status = c.current ? byDay.get(c.day) : undefined;
            return (
              <div key={di} className="flex flex-col items-center gap-0.5 py-1">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium ${
                    isToday ? "bg-[#00b4a6] text-white" : c.current ? "text-gray-700" : "text-gray-300"
                  }`}
                >
                  {c.day}
                </div>
                {status && DOT[status] ? (
                  <span className="h-1 w-1 rounded-full" style={{ backgroundColor: DOT[status] }} title={status.replace("_", " ").toLowerCase()} />
                ) : (
                  <span className="h-1 w-1" />
                )}
              </div>
            );
          })}
        </div>
      ))}
      <div className="mt-2 flex flex-wrap gap-3 border-t border-gray-50 pt-2">
        {(
          [
            ["Present", STATUS_COLOR.present],
            ["Absent", STATUS_COLOR.absent],
            ["Late / half day", STATUS_COLOR.late],
            ["On Leave", STATUS_COLOR.onLeave],
          ] as const
        ).map(([l, c]) => (
          <div key={l} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c }} />
            <span className="text-[10px] text-gray-500">{l}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// --- Recent activity ----------------------------------------------------------

const ACTIVITY_ICON: Record<string, { icon: IconName; color: string }> = {
  approved: { icon: "check-circle", color: "#10b981" },
  rejected: { icon: "x-circle", color: "#ef4444" },
  attendance: { icon: "clock", color: "#3b82f6" },
  payroll: { icon: "pay", color: "#8b5cf6" },
  leave: { icon: "calendar", color: "#f59e0b" },
  document: { icon: "doc", color: "#6b7280" },
  people: { icon: "user", color: "#00b4a6" },
  other: { icon: "doc", color: "#6b7280" },
};

export function RecentActivity({ items, link }: { items: ActivityItem[]; link?: { href: string; label: string } }) {
  return (
    <Panel title="Recent Activity" link={link}>
      {items.length === 0 ? (
        <p className="py-6 text-center text-xs text-gray-400">Nothing yet — your updates will show here.</p>
      ) : (
        <div className="space-y-4">
          {items.map((a, i) => {
            const k = ACTIVITY_ICON[a.kind] ?? ACTIVITY_ICON.other;
            const at = new Date(a.at);
            return (
              <div key={i} className="flex items-start gap-3">
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: k.color + "18" }}
                >
                  <Icon name={k.icon} size={15} color={k.color} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium leading-snug text-[#1a1a2e]">{a.text}</div>
                  <div className="mt-0.5 text-[10px] text-gray-500">
                    {at.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} ·{" "}
                    {at.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// --- Company news (feed) --------------------------------------------------------

interface FeedLite {
  id: string;
  kind: string;
  body: string;
  createdAt: string;
  author: FeedPerson | null;
  subjectEmployee: FeedPerson | null;
}

type FeedPerson = {
  id: string;
  firstName: string;
  lastName: string;
  photo?: { employeeId: string; photoUpdatedAt: string } | null;
};

export function CompanyNews() {
  const [posts, setPosts] = useState<FeedLite[] | null>(null);
  useEffect(() => {
    api<{ pinned: FeedLite[]; items: FeedLite[] }>("GET", "/feed?limit=5")
      .then((f) => setPosts([...f.pinned, ...f.items].slice(0, 5)))
      .catch(() => setPosts([]));
  }, []);
  return (
    <Panel title="Birthdays & News" link={{ href: "/feed", label: "View All" }}>
      {!posts?.length ? (
        <p className="py-6 text-center text-xs text-gray-400">{posts ? "No posts yet." : "Loading…"}</p>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => {
            const who = p.kind === "BIRTHDAY" ? p.subjectEmployee : p.author;
            return (
              <Link key={p.id} href="/feed" className="flex items-center gap-2.5 rounded-lg hover:bg-[#f9fafb]">
                {who ? (
                  <PersonAvatar
                    person={who}
                    photo={who.photo ? { employeeId: who.photo.employeeId, updatedAt: who.photo.photoUpdatedAt } : null}
                  />
                ) : (
                  <span className="h-8 w-8" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-[#1a1a2e]">
                    {p.kind === "BIRTHDAY" ? `🎂 ${who?.firstName ?? ""}'s birthday` : `${who?.firstName ?? ""} ${who?.lastName ?? ""}`}
                  </div>
                  <div className="truncate text-[10px] text-gray-500">{p.body || "Shared a picture"}</div>
                </div>
                <span className="flex-shrink-0 text-[10px] text-gray-400">{formatRelative(p.createdAt)}</span>
              </Link>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// --- Right-hand profile panel ---------------------------------------------------

export function ProfilePanel({
  person,
  photo,
  subtitle,
  badge,
  links,
  actions,
}: {
  person: { firstName: string; lastName: string };
  photo?: { employeeId: string; updatedAt: string | null } | null;
  subtitle: string;
  badge?: string | null;
  links: { label: string; href: string }[];
  actions: { label: string; href: string }[];
}) {
  const url = usePhoto(photo?.employeeId, photo?.updatedAt);
  return (
    <aside className="fixed bottom-0 right-0 top-[60px] hidden w-[240px] flex-shrink-0 flex-col overflow-y-auto border-l border-gray-100 bg-white xl:flex">
      <div
        className="flex h-60 flex-shrink-0 items-center justify-center overflow-hidden bg-gray-100"
        style={url ? undefined : { background: "linear-gradient(135deg,#00b4a6,#34d399)" }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`${person.firstName} ${person.lastName}`} className="h-full w-full object-cover object-top" />
        ) : (
          <span className="text-6xl font-bold text-white/95" style={display}>
            {initials(person)}
          </span>
        )}
      </div>
      <div className="space-y-4 p-4">
        <div>
          <h2 className="text-base font-bold text-[#1a1a2e]" style={display}>
            {person.firstName} {person.lastName}
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
          {badge && (
            <span className="mt-2 inline-block rounded-full bg-[#e8faf8] px-2.5 py-1 text-[10px] font-semibold text-[#00857a]">
              {badge}
            </span>
          )}
        </div>
        <div className="border-t border-gray-50 pt-4">
          <div className="space-y-1">
            {links.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-xs text-gray-600 transition-colors hover:bg-[#f9fafb] hover:text-[#00857a]"
              >
                <span>{l.label}</span>
                <Icon name="chevron-right" size={13} color="#d1d5db" />
              </Link>
            ))}
          </div>
        </div>
        <div className="border-t border-gray-50 pt-4">
          <div className="mb-2 text-xs font-semibold text-[#1a1a2e]" style={display}>
            Quick Actions
          </div>
          <div className="space-y-1">
            {actions.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-xs text-gray-600 transition-colors hover:bg-[#f9fafb] hover:text-[#00857a]"
              >
                <span>{a.label}</span>
                <Icon name="chevron-right" size={13} color="#d1d5db" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
