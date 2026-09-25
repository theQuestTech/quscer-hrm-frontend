"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, Download, Landmark } from "lucide-react";
import { api, downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { formatDate, formatMonth, formatMoney, fullName } from "@/lib/format";
import type { BreakdownLine, Employee, Paginated, PayrollRunDetail, PayrollWarnings } from "@/lib/types";
import { Alert, Button, Card, PageHeader, Spinner, Stat, Table, Td, Th } from "@/components/ui";
import { RequirePermission } from "@/components/app-shell";

export default function PayrollRunPage() {
  return (
    <RequirePermission permission="hrm.payroll.read">
      <PayrollRun />
    </RequirePermission>
  );
}

const STEPS = ["DRAFT", "SUBMITTED", "APPROVED", "LOCKED"] as const;
const STEP_LABELS = { DRAFT: "Draft", SUBMITTED: "Waiting for approval", APPROVED: "Approved", LOCKED: "Paid & locked" };

function PayrollRun() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const run = useApi<PayrollRunDetail>(`/payroll-runs/${id}`);
  const employees = useApi<Paginated<Employee>>(can("hrm.employee.read") ? "/employees?pageSize=100" : null);
  const [warnings, setWarnings] = useState<PayrollWarnings | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bankNotice, setBankNotice] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(`payroll-warnings-${id}`);
      if (stored) setWarnings(JSON.parse(stored));
    } catch {}
  }, [id]);

  async function act(action: "recalculate" | "submit" | "approve" | "lock" | "delete") {
    if (action === "delete" && !window.confirm("Delete this draft payroll run?")) return;
    if (action === "approve" && !window.confirm("Approve this payroll? Loan installments will be deducted and payslips released to employees.")) return;
    if (action === "lock" && !window.confirm("Mark this payroll as paid? It can't be changed afterwards.")) return;
    setBusy(action);
    setError(null);
    try {
      if (action === "delete") {
        await api("DELETE", `/payroll-runs/${id}`);
        router.replace("/payroll");
        return;
      }
      const result = await api<{ warnings?: PayrollWarnings }>("POST", `/payroll-runs/${id}/${action}`);
      if (action === "recalculate" && result.warnings) {
        setWarnings(result.warnings);
        try {
          sessionStorage.setItem(`payroll-warnings-${id}`, JSON.stringify(result.warnings));
        } catch {}
      }
      await run.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function downloadBankFile(periodStart: string) {
    setBusy("bank");
    setError(null);
    setBankNotice(null);
    try {
      const headers = await downloadFile(`/payroll-runs/${id}/bank-file`, `bank-file-${periodStart.slice(0, 7)}.csv`);
      const missing = headers.get("X-Missing-Bank-Details");
      if (missing) {
        setBankNotice(`Not in the file because they have no bank details: ${missing.split(",").join(", ")}. Pay them separately or add their bank details and download again.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not download the bank file");
    } finally {
      setBusy(null);
    }
  }

  if (run.loading && !run.data) return <Spinner />;
  if (run.error) return <Alert>{run.error}</Alert>;
  const r = run.data;
  if (!r) return null;

  const currency = r.lineItems[0]?.currency ?? "PKR";
  const total = (key: "grossSalary" | "totalDeductions" | "netSalary") =>
    r.lineItems.reduce((sum, li) => sum + Number(li[key]), 0);
  const nameOf = (employeeId: string) => {
    const e = employees.data?.items.find((x) => x.id === employeeId);
    return e ? fullName(e) : employeeId;
  };
  const stepIndex = STEPS.indexOf(r.status);
  const canDownload = r.status === "APPROVED" || r.status === "LOCKED";

  const warningLines: { label: string; ids: string[]; hint: string }[] = warnings
    ? [
        { label: "Skipped: no salary set", ids: warnings.skippedNoSalaryStructure, hint: "Set their salary on their profile, then recalculate." },
        { label: "Skipped: no province/country", ids: warnings.skippedNoJurisdiction, hint: "Give them a branch (or a province) so tax can be worked out." },
        { label: "Skipped: joins after this month", ids: warnings.skippedNotYetJoined ?? [], hint: "Nothing to pay yet." },
        { label: "Net pay below zero", ids: warnings.negativeNetPay, hint: "Deductions are bigger than pay — check loans and unpaid days." },
      ].filter((w) => w.ids.length > 0)
    : [];

  return (
    <>
      <Link href="/payroll" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="size-4" /> Payroll
      </Link>
      <PageHeader
        title={`Payroll · ${formatMonth(r.periodStart)}`}
        description={`${formatDate(r.periodStart)} – ${formatDate(r.periodEnd)} · paid on ${formatDate(r.payDate)}`}
        actions={
          <>
            {r.status === "DRAFT" && can("hrm.payroll.run") && (
              <>
                <Button variant="ghost" onClick={() => act("delete")} loading={busy === "delete"}>
                  Delete draft
                </Button>
                <Button variant="secondary" onClick={() => act("recalculate")} loading={busy === "recalculate"}>
                  Recalculate
                </Button>
                <Button onClick={() => act("submit")} loading={busy === "submit"} disabled={r.lineItems.length === 0}>
                  Send for approval
                </Button>
              </>
            )}
            {r.status === "SUBMITTED" && can("hrm.payroll.approve") && (
              <Button onClick={() => act("approve")} loading={busy === "approve"}>
                Approve payroll
              </Button>
            )}
            {canDownload && can("hrm.payroll.approve") && (
              <Button variant="secondary" onClick={() => downloadBankFile(r.periodStart)} loading={busy === "bank"}>
                <Landmark className="size-4" /> Bank file
              </Button>
            )}
            {r.status === "APPROVED" && can("hrm.payroll.approve") && (
              <Button onClick={() => act("lock")} loading={busy === "lock"}>
                Mark as paid
              </Button>
            )}
          </>
        }
      />

      <ol className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        {STEPS.map((step, i) => (
          <li key={step} className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 font-medium ${
                i < stepIndex ? "bg-emerald-50 text-emerald-700" : i === stepIndex ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {STEP_LABELS[step]}
            </span>
            {i < STEPS.length - 1 && <ChevronRight className="size-4 text-slate-300" />}
          </li>
        ))}
      </ol>

      <div className="space-y-6">
        {error && <Alert>{error}</Alert>}
        {bankNotice && <Alert tone="info">{bankNotice}</Alert>}
        {r.status === "DRAFT" && warningLines.length > 0 && (
          <Alert tone="info">
            <p className="font-medium">Check these before sending for approval</p>
            <ul className="mt-2 space-y-1">
              {warningLines.map((w) => (
                <li key={w.label}>
                  <span className="font-medium">{w.label}:</span>{" "}
                  {w.ids.map((eid, i) => (
                    <Fragment key={eid}>
                      {i > 0 && ", "}
                      <Link href={`/employees/${eid}`} className="underline">
                        {nameOf(eid)}
                      </Link>
                    </Fragment>
                  ))}
                  <span className="text-slate-600"> — {w.hint}</span>
                </li>
              ))}
            </ul>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Employees" value={r.lineItems.length} />
          <Stat label="Gross pay" value={formatMoney(total("grossSalary"), currency)} />
          <Stat label="Deductions" value={formatMoney(total("totalDeductions"), currency)} />
          <Stat label="Net pay" value={formatMoney(total("netSalary"), currency)} />
        </div>

        <Card title="Employees" padded={false}>
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <Th>Employee</Th>
                <Th className="text-right">Gross</Th>
                <Th className="hidden text-right sm:table-cell">Deductions</Th>
                <Th className="text-right">Net pay</Th>
                {canDownload && <Th />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {r.lineItems.map((li) => (
                <Fragment key={li.id}>
                  <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setExpanded(expanded === li.id ? null : li.id)}>
                    <Td>
                      <div className="flex items-center gap-2">
                        {expanded === li.id ? <ChevronDown className="size-4 text-slate-400" /> : <ChevronRight className="size-4 text-slate-400" />}
                        <div>
                          <p className="font-medium text-slate-900">{fullName(li.employee)}</p>
                          <p className="text-xs text-slate-500">{li.employee.employeeNumber}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-right">{formatMoney(li.grossSalary, li.currency)}</Td>
                    <Td className="hidden text-right text-red-600 sm:table-cell">−{formatMoney(li.totalDeductions, li.currency)}</Td>
                    <Td className="text-right font-semibold">{formatMoney(li.netSalary, li.currency)}</Td>
                    {canDownload && (
                      <Td className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label="Download payslip"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadFile(`/payroll-runs/${r.id}/employees/${li.employeeId}/payslip`, `payslip-${li.employee.employeeNumber}.pdf`).catch((err) =>
                              setError(err.message),
                            );
                          }}
                        >
                          <Download className="size-4" />
                        </Button>
                      </Td>
                    )}
                  </tr>
                  {expanded === li.id && (
                    <tr className="bg-slate-50">
                      <td colSpan={canDownload ? 5 : 4} className="px-4 py-4">
                        <Breakdown lines={li.breakdown} currency={li.currency} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  );
}

function Breakdown({ lines, currency }: { lines: BreakdownLine[]; currency: string }) {
  const earnings = lines.filter((l) => l.type === "earning");
  const deductions = lines.filter((l) => l.type === "deduction" || l.type === "statutory_deduction" || l.type === "loan_deduction");
  const employer = lines.filter((l) => l.type === "employer_contribution");
  const List = ({ title, items, negative }: { title: string; items: BreakdownLine[]; negative?: boolean }) => (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">None</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {items.map((l, i) => (
            <li key={i} className="flex justify-between gap-4">
              <span>{l.label}</span>
              <span className={negative ? "text-red-600" : undefined}>
                {negative ? "−" : ""}
                {formatMoney(l.amount, currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  return (
    <div className="grid gap-6 sm:grid-cols-3">
      <List title="Earnings" items={earnings} />
      <List title="Deductions" items={deductions} negative />
      <List title="Paid by company (not deducted)" items={employer} />
    </div>
  );
}
