"use client";

import Link from "next/link";
import { type SupportActivity, useSupportApi } from "@/lib/support";
import { activityText } from "@/components/support";
import { Alert, Card, EmptyState, PageHeader, Spinner, Table, Td, Th } from "@/components/ui";

export default function ActivityPage() {
  const log = useSupportApi<SupportActivity[]>("/support/activity");
  return (
    <>
      <PageHeader title="Activity log" description="Everything the support team has done, newest first. It can't be edited." />
      {log.error && <Alert>{log.error}</Alert>}
      <Card padded={false}>
        {log.loading && !log.data ? (
          <Spinner />
        ) : !log.data?.length ? (
          <EmptyState title="Nothing yet" />
        ) : (
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <Th>When</Th>
                <Th>Who</Th>
                <Th>What</Th>
                <Th>Company</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {log.data.map((a) => (
                <tr key={a.id}>
                  <Td>{new Date(a.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</Td>
                  <Td className="font-medium text-slate-900">{a.agentName}</Td>
                  <Td className="max-w-lg whitespace-normal">{activityText(a)}</Td>
                  <Td>
                    {a.organization ? (
                      <Link href={`/support/companies/${a.organization.id}`} className="hover:text-[#00857a] hover:underline">
                        {a.organization.name}
                      </Link>
                    ) : (
                      "—"
                    )}
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
