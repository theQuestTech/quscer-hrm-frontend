"use client";

import Link from "next/link";
import { useState } from "react";
import { type TicketRow, type TicketStatus, useSupportApi } from "@/lib/support";
import { formatRelative } from "@/lib/format";
import { TicketBadge, useOverview } from "@/components/support";
import { Alert, Card, EmptyState, PageHeader, Spinner, Table, Tabs, Td, Th } from "@/components/ui";

type Filter = TicketStatus | "ALL";

export default function TicketsPage() {
  const [filter, setFilter] = useState<Filter>("OPEN");
  const list = useSupportApi<TicketRow[]>(`/support/tickets${filter === "ALL" ? "" : `?status=${filter}`}`);
  const counts = useOverview().data?.tickets ?? {};
  const n = (s: TicketStatus) => (counts[s] ? ` (${counts[s]})` : "");

  return (
    <>
      <PageHeader title="Help requests" description="Questions from people using HRM. Oldest waiting first." />
      <Tabs<Filter>
        tabs={[
          { id: "OPEN", label: `Waiting for us${n("OPEN")}` },
          { id: "ANSWERED", label: `Waiting for them${n("ANSWERED")}` },
          { id: "CLOSED", label: "Closed" },
          { id: "ALL", label: "All" },
        ]}
        value={filter}
        onChange={setFilter}
      />
      {list.error && <Alert>{list.error}</Alert>}
      <Card padded={false}>
        {list.loading && !list.data ? (
          <Spinner />
        ) : !list.data?.length ? (
          <EmptyState title={filter === "OPEN" ? "Nothing waiting — all caught up" : "Nothing here"} />
        ) : (
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <Th>Question</Th>
                <Th>From</Th>
                <Th>Last message</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.data.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <Td className="max-w-md whitespace-normal">
                    <Link href={`/support/tickets/${t.id}`} className="font-medium text-slate-900 hover:text-[#00857a] hover:underline">
                      {t.subject}
                    </Link>
                    {t.lastMessage && (
                      <p className="truncate text-xs text-slate-500">
                        {t.lastMessage.fromSupport ? `${t.lastMessage.author} (us)` : t.lastMessage.author}: {t.lastMessage.body}
                      </p>
                    )}
                  </Td>
                  <Td>
                    {t.user.firstName} {t.user.lastName}
                    <p className="text-xs text-slate-500">{t.organization.name}</p>
                  </Td>
                  <Td>{formatRelative(t.lastMessageAt)}</Td>
                  <Td>
                    <TicketBadge status={t.status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
