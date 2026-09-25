"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { formatDate, formatMonth, formatMoney, fullName } from "@/lib/format";
import type { DashboardSummary, LeaveBalance, MyPayslip } from "@/lib/types";
import { Alert, Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { CheckInWidget } from "@/components/check-in-widget";
import { PayrollStatusBadge } from "@/components/status-badges";

export default function DashboardPage() {
  const { me, can } = useAuth();
  const isHr = can("hrm.employee.read");
  const summary = useApi<DashboardSummary>(isHr ? "/dashboard/summary" : null);
  const balances = useApi<LeaveBalance[]>(me?.employee && can("hrm.leave.read") ? "/leave-balances" : null);
  const payslips = useApi<MyPayslip[]>(me?.employee ? "/my-payslips" : null);

  if (!me) return null;
  const s = summary.data;

  return (
    <>
      <PageHeader title={`Hello, ${me.user.firstName}`} description={me.organization.name} />

      {!me.employee && can("hrm.settings.write") && (
        <div className="mb-6">
          <Alert tone="info">
            Your login isn&apos;t linked to an employee profile yet, so you can&apos;t check in, request leave or get
            payslips. Add yourself under{" "}
            <Link href="/employees/new" className="font-medium underline">
              Employees
            </Link>{" "}
            and then use &ldquo;Give login access → link my account&rdquo; on your profile.
          </Alert>
        </div>
      )}

      <div className="space-y-6">
        <CheckInWidget />

        {isHr && s && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Active employees" value={s.activeEmployees} />
            <Stat label="Checked in today" value={s.presentToday} />
            <Stat label="On leave today" value={s.onLeaveToday} />
            <Link href="/leave?tab=approvals" className="block rounded-xl focus-visible:outline-2 focus-visible:outline-brand-600">
              <Stat label="Leave requests waiting" value={s.pendingLeaveRequests} hint="Review →" />
            </Link>
          </div>
        )}
        {summary.error && <Alert>{summary.error}</Alert>}

        <div className="grid gap-6 lg:grid-cols-2">
          {isHr && s && (
            <Card title="Documents expiring in the next 30 days" padded={false}>
              {s.expiringDocuments.length === 0 ? (
                <EmptyState title="Nothing expiring soon" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {s.expiringDocuments.map((d) => (
                    <li key={d.id} className="flex items-center justify-between px-5 py-3 text-sm">
                      <Link href={`/employees/${d.employee.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                        {fullName(d.employee)} · {d.category}
                      </Link>
                      <span className="text-amber-700">{formatDate(d.expiryDate)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {isHr && s && can("hrm.payroll.read") && (
            <Card title="Latest payroll">
              {s.latestPayrollRun ? (
                <Link href={`/payroll/${s.latestPayrollRun.id}`} className="flex items-center justify-between text-sm hover:text-brand-700">
                  <span className="font-medium">{formatMonth(s.latestPayrollRun.periodStart)}</span>
                  <PayrollStatusBadge status={s.latestPayrollRun.status} />
                </Link>
              ) : (
                <p className="text-sm text-slate-500">
                  No payroll run yet. <Link href="/payroll" className="text-brand-600">Start one →</Link>
                </p>
              )}
            </Card>
          )}

          {me.employee && balances.data && balances.data.length > 0 && (
            <Card title="My leave balance" actions={<Link href="/leave" className="text-sm text-brand-600">Request leave →</Link>}>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {balances.data
                  .filter((b) => b.leaveType.isPaid)
                  .map((b) => (
                    <div key={b.leaveType.id}>
                      <dt className="text-xs text-slate-500">{b.leaveType.name}</dt>
                      <dd className="text-xl font-semibold">{b.remainingDays}</dd>
                    </div>
                  ))}
              </dl>
            </Card>
          )}

          {me.employee && payslips.data && (
            <Card title="My latest payslip" actions={<Link href="/payslips" className="text-sm text-brand-600">All payslips →</Link>}>
              {payslips.data[0] ? (
                <div className="flex items-center justify-between text-sm">
                  <span>{formatMonth(payslips.data[0].periodStart)}</span>
                  <span className="text-lg font-semibold">{formatMoney(payslips.data[0].netSalary, payslips.data[0].currency)}</span>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No payslips yet.</p>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
