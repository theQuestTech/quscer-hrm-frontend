"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { CalendarDays, Clock, Download, Headset, KeyRound, Landmark, Users as UsersIcon, Activity } from "lucide-react";
import { api, downloadFile } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { Alert, Button, Card, EmptyState, Field, Input, Select, Spinner, cx } from "@/components/ui";

// Settings → Activity history: everything done in the company, newest first,
// by the team and by Quscer support. Read only.

type Area = "payroll" | "leave" | "people" | "attendance" | "recruitment" | "training" | "performance" | "access" | "support" | "other";

interface ActivityItem {
  id: string;
  at: string;
  area: Area;
  eventType: string;
  actor: { name: string; isSupport: boolean };
  text: string; // may hold "{subject}" where the link goes
  subject: { label: string; href: string | null } | null;
  detail: string | null;
}

const AREAS: { id: Exclude<Area, "other">; label: string }[] = [
  { id: "payroll", label: "Payroll" },
  { id: "leave", label: "Leave" },
  { id: "people", label: "People" },
  { id: "attendance", label: "Attendance" },
  { id: "recruitment", label: "Recruitment" },
  { id: "training", label: "Training" },
  { id: "performance", label: "Performance" },
  { id: "access", label: "Access & security" },
  { id: "support", label: "Quscer support" },
];

const ICON: Record<Area, { icon: typeof Activity; className: string }> = {
  payroll: { icon: Landmark, className: "bg-emerald-50 text-emerald-700" },
  leave: { icon: CalendarDays, className: "bg-blue-50 text-blue-700" },
  people: { icon: UsersIcon, className: "bg-violet-50 text-violet-700" },
  recruitment: { icon: UsersIcon, className: "bg-violet-50 text-violet-700" },
  training: { icon: UsersIcon, className: "bg-violet-50 text-violet-700" },
  performance: { icon: UsersIcon, className: "bg-violet-50 text-violet-700" },
  attendance: { icon: Clock, className: "bg-orange-50 text-orange-700" },
  access: { icon: KeyRound, className: "bg-red-50 text-red-700" },
  support: { icon: Headset, className: "bg-amber-100 text-amber-800" },
  other: { icon: Activity, className: "bg-slate-100 text-slate-600" },
};

export function ActivityHistory() {
  const [area, setArea] = useState("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const people = useApi<{ id: string; name: string }[]>("/activity/people");

  const query = new URLSearchParams(Object.entries({ area, actor, from, to }).filter(([, v]) => v)).toString();

  const load = useCallback(
    async (after: string | null) => {
      if (after) setMore(true);
      else setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams(query);
        if (after) q.set("cursor", after);
        const page = await api<{ items: ActivityItem[]; nextCursor: string | null }>("GET", `/activity?${q}`);
        setItems((prev) => (after ? [...prev, ...page.items] : page.items));
        setCursor(page.nextCursor);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load the activity history");
      } finally {
        setLoading(false);
        setMore(false);
      }
    },
    [query],
  );

  useEffect(() => {
    load(null);
  }, [load]);

  async function download() {
    setDownloading(true);
    try {
      await downloadFile(`/activity/export${query ? `?${query}` : ""}`, "activity-history.csv");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not download");
    } finally {
      setDownloading(false);
    }
  }

  const days = groupByDay(combineRepeats(items));

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-[#1a1a2e]">Activity history</h2>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Everything done in this company, newest first — by your team and by Quscer support. It can&apos;t be edited or deleted.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={download} loading={downloading}>
          <Download className="size-4" /> Download CSV
        </Button>
      </div>

      <div className="grid gap-3 border-b border-gray-100 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Area">
          <Select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">All areas</option>
            {AREAS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Who">
          <Select value={actor} onChange={(e) => setActor(e.target.value)}>
            <option value="">Everyone</option>
            <option value="support">Quscer support</option>
            {people.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="From">
          <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>

      {error && (
        <div className="p-5">
          <Alert>{error}</Alert>
        </div>
      )}
      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState title={query ? "Nothing matches these filters" : "Nothing yet"} />
      ) : (
        <>
          {days.map(([day, lines]) => (
            <Fragment key={day}>
              <h3 className="border-b border-slate-100 bg-slate-50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{day}</h3>
              <ul className="divide-y divide-slate-100">
                {lines.map((line) => (
                  <Line key={line.item.id} item={line.item} count={line.count} />
                ))}
              </ul>
            </Fragment>
          ))}
          {cursor && (
            <div className="border-t border-slate-100 p-4 text-center">
              <Button variant="secondary" size="sm" loading={more} onClick={() => load(cursor)}>
                Show older activity
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function Line({ item, count }: { item: ActivityItem; count: number }) {
  const { icon: Icon, className } = ICON[item.area] ?? ICON.other;
  const subject = item.subject ? (
    item.subject.href ? (
      <Link href={item.subject.href} className="text-[#00857a] underline hover:no-underline">
        {item.subject.label}
      </Link>
    ) : (
      <span className="font-medium">{item.subject.label}</span>
    )
  ) : null;
  // "{subject}" marks where the link goes inside the sentence; otherwise it follows it.
  const [before, after] = item.text.split("{subject}");
  const inSentence = after !== undefined;
  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <span aria-hidden className={cx("grid size-8 shrink-0 place-items-center rounded-lg", className)}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1 text-sm text-slate-700">
        <p>
          <span className="font-semibold text-[#1a1a2e]">{item.actor.name}</span> {before}
          {inSentence ? (
            <>
              {subject ?? "someone"}
              {after}
            </>
          ) : (
            subject && <> · {subject}</>
          )}
          {count > 1 && <span className="text-slate-500"> ({count} times)</span>}
          {item.actor.isSupport && (
            <span className="ml-2 inline-block rounded-md bg-amber-100 px-1.5 py-0.5 align-middle text-[11px] font-semibold text-amber-800">Quscer support</span>
          )}
        </p>
        {item.detail && count === 1 && <p className="mt-0.5 break-words text-[13px] text-slate-500">{item.detail}</p>}
      </div>
      <time dateTime={item.at} className="shrink-0 whitespace-nowrap text-xs text-slate-400" title={new Date(item.at).toLocaleString("en-GB")}>
        {new Date(item.at).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true })}
      </time>
    </li>
  );
}

// The same person doing the same thing several times in a row on the same
// day (e.g. marking a whole register) becomes one line with a count. The
// line then names what it's about only if every repeat was about the same.
function combineRepeats(items: ActivityItem[]) {
  const lines: { item: ActivityItem; count: number }[] = [];
  for (const item of items) {
    const last = lines[lines.length - 1];
    if (
      last &&
      last.item.eventType === item.eventType &&
      last.item.actor.name === item.actor.name &&
      dayKey(last.item.at) === dayKey(item.at)
    ) {
      if (last.item.subject?.label !== item.subject?.label) last.item = { ...last.item, subject: null };
      last.count += 1;
      continue;
    }
    lines.push({ item, count: 1 });
  }
  return lines;
}

function dayKey(at: string) {
  return new Date(at).toDateString();
}

function groupByDay(lines: { item: ActivityItem; count: number }[]) {
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  const label = (d: Date) =>
    d.toDateString() === today.toDateString()
      ? "Today"
      : d.toDateString() === yesterday.toDateString()
        ? "Yesterday"
        : d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const groups: [string, typeof lines][] = [];
  for (const line of lines) {
    const l = label(new Date(line.item.at));
    const last = groups[groups.length - 1];
    if (last?.[0] === l) last[1].push(line);
    else groups.push([l, [line]]);
  }
  return groups;
}
