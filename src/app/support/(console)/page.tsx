"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { type CompanyRow, useSupportApi } from "@/lib/support";
import { formatDate, formatRelative } from "@/lib/format";
import { useOverview } from "@/components/support";
import { Alert, Badge, Card, EmptyState, Input, PageHeader, Spinner, Stat, Table, Td, Th, cx } from "@/components/ui";

export default function CompaniesPage() {
  const overview = useOverview();
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const list = useSupportApi<CompanyRow[]>(`/support/companies${term ? `?q=${encodeURIComponent(term)}` : ""}`);
  const o = overview.data;

  return (
    <>
      <PageHeader
        title="Companies"
        description="Every company using Quscer People."
        actions={
          <Input
            type="search"
            aria-label="Search companies"
            placeholder="Search company, person or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-72"
          />
        }
      />
      {o && !o.emailEnabled && (
        <div className="mb-4">
          <Alert>Email is off on the server (RESEND_API_KEY isn&apos;t set) — nobody gets any email.</Alert>
        </div>
      )}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Companies" value={o?.companies ?? "—"} hint={o?.suspended ? `${o.suspended} switched off` : undefined} />
        <Stat label="People active (7 days)" value={o?.activeUsers ?? "—"} />
        <Stat label="Machines offline" value={<span className={cx(!!o?.machinesOffline && "text-amber-600")}>{o?.machinesOffline ?? "—"}</span>} />
        <Stat
          label="Email problems (24 h)"
          value={<span className={cx(!!o?.emailProblems && "text-red-600")}>{o?.emailProblems ?? "—"}</span>}
          hint="Failed, bounced or marked as spam"
        />
      </div>
      {list.error && <Alert>{list.error}</Alert>}
      <Card padded={false}>
        {list.loading && !list.data ? (
          <Spinner />
        ) : !list.data?.length ? (
          <EmptyState title={term ? "No company matches" : "No companies yet"} />
        ) : (
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <Th>Company</Th>
                <Th>People</Th>
                <Th>Last activity</Th>
                <Th>Machines</Th>
                <Th>Emails</Th>
                <Th>Help</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.data.map((c) => (
                <tr key={c.id} className={cx("hover:bg-slate-50", c.suspendedAt && "opacity-60")}>
                  <Td>
                    <Link href={`/support/companies/${c.id}`} className="font-semibold text-slate-900 hover:text-[#00857a] hover:underline">
                      {c.name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {c.suspendedAt ? `Switched off ${formatDate(c.suspendedAt)}` : `Since ${formatDate(c.createdAt)}`}
                      {c.ownerEmail && ` · ${c.ownerEmail}`}
                    </p>
                  </Td>
                  <Td>
                    {c.employees} employee{c.employees === 1 ? "" : "s"}
                    <p className="text-xs text-slate-500">
                      {c.logins} login{c.logins === 1 ? "" : "s"}
                    </p>
                  </Td>
                  <Td>{c.lastSeenAt ? formatRelative(c.lastSeenAt) : "Never"}</Td>
                  <Td>
                    <MachinesBadge m={c.machines} />
                  </Td>
                  <Td>
                    {!c.emails.on ? (
                      <Badge>Off</Badge>
                    ) : c.emails.problems24h ? (
                      <Badge tone="red">{c.emails.problems24h} failed</Badge>
                    ) : (
                      <Badge tone="green">Working</Badge>
                    )}
                  </Td>
                  <Td>{c.openTickets ? <Badge tone="yellow">{c.openTickets} open</Badge> : <span className="text-slate-400">—</span>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}

function MachinesBadge({ m }: { m: CompanyRow["machines"] }) {
  if (!m.total) return <span className="text-slate-400">None</span>;
  const offline = m.total - m.online - m.notConnected;
  if (offline) return <Badge tone="yellow">{offline} offline</Badge>;
  if (m.notConnected && !m.online) return <Badge tone="yellow">Not connected yet</Badge>;
  return <Badge tone="green">{m.online} online</Badge>;
}
