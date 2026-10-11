"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/use-api";
import { formatRelative, formatTime, fullName, initials } from "@/lib/format";
import type { LivePerson, LiveStatus } from "@/lib/types";
import { Alert, Card, EmptyState, PageHeader, Spinner } from "@/components/ui";
import { RequirePermission } from "@/components/app-shell";
import { TrackingMap, type MapDot } from "@/components/tracking-map";
import { LiveBadge, NotSwitchedOn, STATUS, useFieldTracking } from "@/components/tracking";

export default function FieldTeamPage() {
  const on = useFieldTracking();
  return <RequirePermission permission="hrm.attendance.approve">{on ? <FieldTeam /> : <NotSwitchedOn />}</RequirePermission>;
}

const ORDER: LiveStatus[] = ["LOCATION_OFF", "NO_SIGNAL", "LIVE", "WAITING", "NOT_CHECKED_IN"];

function FieldTeam() {
  const router = useRouter();
  const live = useApi<LivePerson[]>("/tracking/live");
  const { reload } = live;

  // Refresh every minute.
  useEffect(() => {
    const t = setInterval(reload, 60_000);
    return () => clearInterval(t);
  }, [reload]);

  const people = useMemo(
    () => [...(live.data ?? [])].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || fullName(a.employee).localeCompare(fullName(b.employee))),
    [live.data],
  );
  const counts = ORDER.map((s) => ({ status: s, n: people.filter((p) => p.status === s).length }));

  // People on duty with a position today. Off-duty people aren't shown on the map.
  const dots: MapDot[] = useMemo(
    () =>
      people
        .filter((p) => p.last && p.status !== "NOT_CHECKED_IN")
        .map((p) => ({
          id: p.employee.id,
          latitude: p.last!.latitude,
          longitude: p.last!.longitude,
          color: STATUS[p.status].color,
          label: initials(p.employee),
          size: 32,
          title: `${fullName(p.employee)} — ${STATUS[p.status].label}, ${formatRelative(p.last!.at)}${p.visit ? ` · at ${p.visit.place}` : ""}`,
          onClick: () => router.push(`/tracking/route?employee=${p.employee.id}`),
        })),
    [people, router],
  );

  return (
    <div>
      <PageHeader title="Field team" description="Where your field staff are, while they're checked in. Updates every minute." />
      {live.error && <Alert>{live.error}</Alert>}
      {live.loading && !live.data ? (
        <Spinner />
      ) : !people.length ? (
        <Card>
          <EmptyState
            title="No field staff yet"
            description="HR marks people as field staff on their profile (Edit → Attendance → Field staff). Only they are tracked, and only while checked in."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {counts
              .filter((c) => c.n)
              .map((c) => (
                <span key={c.status} className="inline-flex items-center gap-2 rounded-full border border-gray-100 bg-white px-3 py-1 text-sm" title={STATUS[c.status].help}>
                  <span className="size-2.5 rounded-full" style={{ background: STATUS[c.status].color }} />
                  {STATUS[c.status].label}: <strong>{c.n}</strong>
                </span>
              ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <Card padded={false}>
              <TrackingMap dots={dots} height={520} />
            </Card>
            <Card title="People" padded={false}>
              <ul className="max-h-[520px] divide-y divide-gray-100 overflow-y-auto">
                {people.map((p) => (
                  <li key={p.employee.id}>
                    <Link href={`/tracking/route?employee=${p.employee.id}`} className="block px-4 py-3 hover:bg-slate-50">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[#1a1a2e]">{fullName(p.employee)}</span>
                        <LiveBadge status={p.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">{p.employee.designation}</p>
                      <p className="mt-1 text-xs text-slate-600">{describe(p)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function describe(p: LivePerson): string {
  const battery = p.last?.battery != null && p.status !== "NOT_CHECKED_IN" ? ` · battery ${p.last.battery}%` : "";
  switch (p.status) {
    case "LIVE":
      return `${p.visit ? `At ${p.visit.place} since ${formatTime(p.visit.arrivedAt)}` : `Last seen ${formatRelative(p.last!.at)}`}${battery}`;
    case "WAITING":
      return `Checked in at ${formatTime(p.checkedInAt)} — waiting for the first position`;
    case "NO_SIGNAL":
      return `Nothing since ${formatTime(p.since)}${battery}`;
    case "LOCATION_OFF":
      return `Location off since ${formatTime(p.since)}`;
    default:
      return p.last ? `Off duty — last position ${formatRelative(p.last.at)}` : "Off duty";
  }
}
