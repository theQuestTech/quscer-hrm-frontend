"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { formatDate, formatMonth, formatMoney } from "@/lib/format";
import type { PayrollRunDetail, PayrollRunSummary, PayrollWarnings } from "@/lib/types";
import { Alert, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Spinner, Table, Td, Th } from "@/components/ui";
import { PayrollStatusBadge } from "@/components/status-badges";
import { RequirePermission } from "@/components/app-shell";

export default function PayrollPage() {
  return (
    <RequirePermission permission="hrm.payroll.read">
      <PayrollRuns />
    </RequirePermission>
  );
}

function PayrollRuns() {
  const { can } = useAuth();
  const router = useRouter();
  const runs = useApi<PayrollRunSummary[]>("/payroll-runs");
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Payroll"
        description="Run payroll once a month: create the run, check it, then send it for approval."
        actions={
          can("hrm.payroll.run") && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" /> New payroll run
            </Button>
          )
        }
      />
      <Card padded={false}>
        {runs.error && (
          <div className="p-4">
            <Alert>{runs.error}</Alert>
          </div>
        )}
        {runs.loading && !runs.data ? (
          <Spinner />
        ) : !runs.data?.length ? (
          <EmptyState
            title="No payroll runs yet"
            description="Set each employee's salary on their profile first, then start a run for the month."
          />
        ) : (
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <Th>Month</Th>
                <Th className="hidden sm:table-cell">Pay date</Th>
                <Th>Employees</Th>
                <Th>Total net pay</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {runs.data.map((r) => (
                <tr key={r.id} className="cursor-pointer hover:bg-slate-50" onClick={() => router.push(`/payroll/${r.id}`)}>
                  <Td>
                    <Link href={`/payroll/${r.id}`} className="font-medium text-slate-900 hover:text-brand-700" onClick={(e) => e.stopPropagation()}>
                      {formatMonth(r.periodStart)}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {formatDate(r.periodStart)} – {formatDate(r.periodEnd)}
                    </div>
                  </Td>
                  <Td className="hidden sm:table-cell">{formatDate(r.payDate)}</Td>
                  <Td>{r.employeeCount}</Td>
                  <Td className="font-medium">{formatMoney(r.totalNet, r.currency ?? "PKR")}</Td>
                  <Td>
                    <PayrollStatusBadge status={r.status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <NewRunModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  return { periodStart: `${month}-01`, periodEnd: `${month}-${String(last).padStart(2, "0")}`, nextMonthFirst: next };
}

function NewRunModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const bounds = monthBounds(month);
  const [payDate, setPayDate] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await api<{ run: PayrollRunDetail; warnings: PayrollWarnings }>("POST", "/payroll-runs", {
        periodStart: bounds.periodStart,
        periodEnd: bounds.periodEnd,
        payDate: payDate || bounds.periodEnd,
      });
      // Hand the exception list to the run page — it's only returned when calculating.
      try {
        sessionStorage.setItem(`payroll-warnings-${result.run.id}`, JSON.stringify(result.warnings));
      } catch {}
      router.push(`/payroll/${result.run.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the run");
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New payroll run">
      <form onSubmit={create} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Month">
          <Input type="month" required value={month} onChange={(e) => setMonth(e.target.value)} />
        </Field>
        <Field label="Pay date" hint="Defaults to the last day of the month">
          <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
        </Field>
        <p className="text-sm text-slate-500">
          Pay is worked out for every active employee with a salary. Unpaid leave, days marked absent and days before joining are
          deducted automatically. Nothing is final until it&apos;s approved.
        </p>
        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            Create and calculate
          </Button>
        </div>
      </form>
    </Modal>
  );
}
