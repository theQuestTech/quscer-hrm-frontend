"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { formatDate, formatMonth, formatMoney } from "@/lib/format";
import type { MyPayslip } from "@/lib/types";
import { Alert, Button, Card, EmptyState, PageHeader, Spinner, Table, Td, Th } from "@/components/ui";

export default function PayslipsPage() {
  const { me } = useAuth();
  const payslips = useApi<MyPayslip[]>(me?.employee ? "/my-payslips" : null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(p: MyPayslip) {
    setDownloading(p.runId);
    setError(null);
    try {
      await downloadFile(`/payroll-runs/${p.runId}/my-payslip`, `payslip-${p.periodStart.slice(0, 7)}.pdf`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not download");
    } finally {
      setDownloading(null);
    }
  }

  if (!me?.employee) {
    return (
      <>
        <PageHeader title="My payslips" />
        <Alert tone="info">Your login isn&apos;t linked to an employee profile yet. Ask HR to link it.</Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader title="My payslips" description="Payslips appear here once payroll for the month is approved." />
      <Card padded={false}>
        {(error || payslips.error) && (
          <div className="p-4">
            <Alert>{error ?? payslips.error}</Alert>
          </div>
        )}
        {payslips.loading && !payslips.data ? (
          <Spinner />
        ) : !payslips.data?.length ? (
          <EmptyState title="No payslips yet" />
        ) : (
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <Th>Month</Th>
                <Th className="hidden sm:table-cell">Paid on</Th>
                <Th className="hidden text-right sm:table-cell">Gross</Th>
                <Th className="hidden text-right sm:table-cell">Deductions</Th>
                <Th className="text-right">Net pay</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payslips.data.map((p) => (
                <tr key={p.runId}>
                  <Td className="font-medium text-slate-900">{formatMonth(p.periodStart)}</Td>
                  <Td className="hidden sm:table-cell">{formatDate(p.payDate)}</Td>
                  <Td className="hidden text-right sm:table-cell">{formatMoney(p.grossSalary, p.currency)}</Td>
                  <Td className="hidden text-right text-red-600 sm:table-cell">−{formatMoney(p.totalDeductions, p.currency)}</Td>
                  <Td className="text-right font-semibold">{formatMoney(p.netSalary, p.currency)}</Td>
                  <Td className="text-right">
                    <Button size="sm" variant="secondary" loading={downloading === p.runId} onClick={() => download(p)}>
                      <Download className="size-4" /> PDF
                    </Button>
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
