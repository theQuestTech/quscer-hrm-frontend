"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { formatDate, formatMinutes, formatTime, fullName, todayInput } from "@/lib/format";
import type { DayRoute } from "@/lib/types";
import { Alert, Button, Card, EmptyState, Input, PageHeader, Spinner, Stat } from "@/components/ui";
import { TrackingMap, type MapDot } from "@/components/tracking-map";
import { NotSwitchedOn, useFieldTracking } from "@/components/tracking";

// One person's working day: route on the map, distance, stops, client visits
// and when location was off. ?employee=<id>&date=YYYY-MM-DD; without
// employee it's your own day.

export default function RoutePage() {
  const on = useFieldTracking();
  if (!on) return <NotSwitchedOn />;
  return (
    <Suspense fallback={<Spinner />}>
      <DayRouteFor />
    </Suspense>
  );
}

// A new page (and fresh state) for each person, read from the address.
function DayRouteFor() {
  const params = useSearchParams();
  const employee = params.get("employee");
  return <DayRouteView key={employee ?? "me"} employee={employee} initialDate={params.get("date")} />;
}

function shiftDay(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type Entry = { at: string; text: string; detail?: string; color: string };

function DayRouteView({ employee, initialDate }: { employee: string | null; initialDate: string | null }) {
  const { can } = useAuth();
  // No date = today in the company's time zone (the server decides).
  const [picked, setPicked] = useState(initialDate);
  const query = new URLSearchParams({ ...(picked ? { date: picked } : {}), ...(employee ? { employeeId: employee } : {}) });
  const route = useApi<DayRoute>(`/tracking/route?${query}`);
  const r = route.data;
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    if (!picked && r) setToday(r.date);
  }, [picked, r]);
  const date = picked ?? r?.date ?? todayInput();
  const setDate = (d: string) => setPicked(today && d === today ? null : d);

  // Keep the address in step, so the page can be shared or refreshed.
  useEffect(() => {
    const q = new URLSearchParams({ ...(employee ? { employee } : {}), ...(picked ? { date: picked } : {}) });
    window.history.replaceState(null, "", `/tracking/route?${q}`);
  }, [employee, picked]);

  const dots: MapDot[] = useMemo(() => {
    if (!r) return [];
    const out: MapDot[] = [];
    const first = r.points[0];
    const last = r.points[r.points.length - 1];
    if (first) out.push({ id: "start", latitude: first.latitude, longitude: first.longitude, color: "#059669", label: "S", size: 26, title: `Start ${formatTime(first.at)}` });
    if (last && last !== first)
      out.push({ id: "end", latitude: last.latitude, longitude: last.longitude, color: "#1a1a2e", label: r.checkOut ? "E" : "•", size: 26, title: `${r.checkOut ? "Last position" : "Latest"} ${formatTime(last.at)}` });
    r.stops.forEach((s, i) =>
      out.push({ id: `stop${i}`, latitude: s.latitude, longitude: s.longitude, color: "#d97706", label: String(i + 1), size: 24, title: `Stop ${i + 1}: ${formatTime(s.arrivedAt)}–${formatTime(s.leftAt)} (${formatMinutes(s.minutes)})` }),
    );
    r.visits.forEach((v) =>
      out.push({ id: v.id, latitude: v.latitude, longitude: v.longitude, color: "#4f46e5", label: "V", size: 26, title: `${v.place} — ${formatTime(v.arrivedAt)}${v.leftAt ? `–${formatTime(v.leftAt)}` : ", still there"}` }),
    );
    return out;
  }, [r]);

  const timeline: Entry[] = useMemo(() => {
    if (!r?.checkIn) return [];
    const e: Entry[] = [{ at: r.checkIn, text: "Checked in", color: "#059669" }];
    r.stops.forEach((s, i) => e.push({ at: s.arrivedAt, text: `Stop ${i + 1}`, detail: `${formatMinutes(s.minutes)}, until ${formatTime(s.leftAt)}`, color: "#d97706" }));
    r.visits.forEach((v) =>
      e.push({ at: v.arrivedAt, text: `Visit: ${v.place}`, detail: [v.leftAt ? `until ${formatTime(v.leftAt)}` : "still there", v.notes].filter(Boolean).join(" · "), color: "#4f46e5" }),
    );
    r.events.forEach((ev) =>
      e.push({
        at: ev.at,
        text: ev.kind === "LOCATION_ON" ? "Location back on" : ev.kind === "PERMISSION_DENIED" ? "Location permission taken away" : "Location switched off",
        color: ev.kind === "LOCATION_ON" ? "#059669" : "#dc2626",
      }),
    );
    if (r.checkOut) e.push({ at: r.checkOut, text: "Checked out", color: "#1a1a2e" });
    return e.sort((a, b) => a.at.localeCompare(b.at));
  }, [r]);

  const last = today ?? todayInput();
  return (
    <div>
      <PageHeader
        title={r ? `${fullName(r.employee)} — ${formatDate(r.date)}` : "Daily route"}
        description="Positions are recorded only between check-in and check-out."
        actions={
          <div className="flex items-center gap-2">
            {can("hrm.attendance.approve") && (
              <Link href="/tracking" className="whitespace-nowrap text-sm text-brand-700 hover:underline">
                ← Field team
              </Link>
            )}
            <Button variant="secondary" onClick={() => setDate(shiftDay(date, -1))} aria-label="Day before">
              ‹
            </Button>
            <Input type="date" value={date} max={last} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-40" />
            <Button variant="secondary" onClick={() => setDate(shiftDay(date, 1))} disabled={date >= last} aria-label="Next day">
              ›
            </Button>
          </div>
        }
      />
      {route.error && <Alert>{route.error}</Alert>}
      {route.loading && !r ? (
        <Spinner />
      ) : !r ? null : !r.checkIn ? (
        <Card>
          <EmptyState title="Not checked in this day" description="Nothing is recorded on days without a check-in." />
        </Card>
      ) : (
        <div className="space-y-4">
          {!r.employee.fieldStaff && <Alert tone="info">This person isn&apos;t marked as field staff now, so they aren&apos;t being tracked.</Alert>}
          <div className="grid gap-4 sm:grid-cols-4">
            <Stat label="Working time" value={`${formatTime(r.checkIn)}–${r.checkOut ? formatTime(r.checkOut) : "now"}`} />
            <Stat label="Distance" value={`${r.distanceKm} km`} hint="Along the recorded positions" />
            <Stat label="Stops (10 min+)" value={r.stops.length} />
            <Stat label="Client visits" value={r.visits.length} />
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <Card padded={false}>
              {r.points.length ? (
                <TrackingMap key={`${employee}-${date}`} dots={dots} line={r.points} height={520} />
              ) : (
                <div className="p-10">
                  <EmptyState title="No positions this day" description="The phone didn't send any — location off, no internet, or the app wasn't set up." />
                </div>
              )}
            </Card>
            <Card title="The day" padded={false}>
              <ol className="max-h-[520px] overflow-y-auto px-4 py-3">
                {timeline.map((e, i) => (
                  <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                    <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: e.color }} />
                    <div>
                      <p className="text-sm">
                        <span className="font-medium tabular-nums text-slate-500">{formatTime(e.at)}</span> <span className="text-[#1a1a2e]">{e.text}</span>
                      </p>
                      {e.detail && <p className="text-xs text-slate-500">{e.detail}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
