"use client";

import { useEffect, useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { api, downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { formatDate, formatMoney, humanize, todayInput, toDateInput } from "@/lib/format";
import type { EmployeeProfile, ExitReason, FinalSettlement } from "@/lib/types";
import { Alert, Button, Card, Field, Input, Select, Spinner, Table, Td, Textarea, Th } from "@/components/ui";
import { SettlementStatusBadge } from "@/components/status-badges";

// WBS 4.14 — final settlement for someone leaving. HR fills in the few
// things the system can't know (last day, reason, notice, extras), the
// backend works out the money, and an approver signs it off. Approving
// ends the employment, so it asks for confirmation.

const REASONS: ExitReason[] = ["RESIGNATION", "TERMINATION", "END_OF_CONTRACT", "RETIREMENT", "OTHER"];

type Adjustment = { label: string; amount: string; type: "earning" | "deduction" };

export function SettlementSection({ employee, onChange }: { employee: EmployeeProfile; onChange: () => void }) {
  const { can } = useAuth();
  const settlement = useApi<FinalSettlement | null>(`/employees/${employee.id}/final-settlement`);
  const s = settlement.data;
  const canDraft = can("hrm.payroll.run");
  const canApprove = can("hrm.payroll.approve");

  const [form, setForm] = useState({
    lastWorkingDay: todayInput(),
    reason: "RESIGNATION" as ExitReason,
    includeGratuity: false,
    noticeDaysInLieu: "",
    noticeDaysShort: "",
    notes: "",
  });
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Start the form from the saved draft so "Recalculate" keeps its inputs.
  useEffect(() => {
    if (!s) return;
    setForm({
      lastWorkingDay: toDateInput(s.lastWorkingDay),
      reason: s.reason,
      includeGratuity: !!s.inputs.includeGratuity,
      noticeDaysInLieu: s.inputs.noticeDaysInLieu ? String(s.inputs.noticeDaysInLieu) : "",
      noticeDaysShort: s.inputs.noticeDaysShort ? String(s.inputs.noticeDaysShort) : "",
      notes: s.inputs.notes ?? "",
    });
    setAdjustments((s.inputs.adjustments ?? []).map((a) => ({ ...a, amount: String(a.amount) })));
  }, [s]);

  async function act(name: string, fn: () => Promise<unknown>) {
    setBusy(name);
    setError(null);
    try {
      await fn();
      await settlement.reload();
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  function calculate(e: React.FormEvent) {
    e.preventDefault();
    act("calculate", () =>
      api("POST", `/employees/${employee.id}/final-settlement`, {
        lastWorkingDay: form.lastWorkingDay,
        reason: form.reason,
        includeGratuity: form.includeGratuity,
        noticeDaysInLieu: Number(form.noticeDaysInLieu) || 0,
        noticeDaysShort: Number(form.noticeDaysShort) || 0,
        adjustments: adjustments
          .filter((a) => a.label.trim() && Number(a.amount) > 0)
          .map((a) => ({ label: a.label.trim(), amount: Number(a.amount), type: a.type })),
        ...(form.notes && { notes: form.notes }),
      }),
    );
  }

  if (settlement.loading && !settlement.data) return <Spinner />;

  const isDraft = !s || s.status === "DRAFT";
  const editable = isDraft && canDraft && employee.status !== "TERMINATED";

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-2">
        {error && <Alert>{error}</Alert>}
        {settlement.error && <Alert>{settlement.error}</Alert>}
        {editable ? (
          <Card title={s ? "Change and recalculate" : "Start final settlement"}>
            <form onSubmit={calculate} className="space-y-4">
              <Field label="Last working day">
                <Input
                  type="date"
                  required
                  min={toDateInput(employee.dateOfJoining)}
                  value={form.lastWorkingDay}
                  onChange={(e) => setForm({ ...form, lastWorkingDay: e.target.value })}
                />
              </Field>
              <Field label="Reason for leaving">
                <Select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value as ExitReason })}>
                  {REASONS.map((r) => (
                    <option key={r} value={r}>
                      {humanize(r)}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Notice paid (days)" hint="Company pays instead of notice">
                  <Input type="number" min={0} max={365} value={form.noticeDaysInLieu} onChange={(e) => setForm({ ...form, noticeDaysInLieu: e.target.value })} />
                </Field>
                <Field label="Notice not served (days)" hint="Taken back from the employee">
                  <Input type="number" min={0} max={365} value={form.noticeDaysShort} onChange={(e) => setForm({ ...form, noticeDaysShort: e.target.value })} />
                </Field>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.includeGratuity}
                  onChange={(e) => setForm({ ...form, includeGratuity: e.target.checked })}
                />
                <span>
                  Pay gratuity
                  <span className="block text-xs text-slate-500">One month&apos;s basic salary per full year worked.</span>
                </span>
              </label>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-slate-700">Other amounts</legend>
                {adjustments.map((a, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-2 rounded-lg bg-slate-50 p-2">
                    <Input
                      className="col-span-3"
                      aria-label="What for"
                      placeholder="e.g. Laptop not returned"
                      value={a.label}
                      onChange={(e) => setAdjustments(adjustments.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                    />
                    <Input
                      aria-label="Amount"
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Amount"
                      value={a.amount}
                      onChange={(e) => setAdjustments(adjustments.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                    />
                    <Select
                      aria-label="Pay or take back"
                      className="w-32"
                      value={a.type}
                      onChange={(e) =>
                        setAdjustments(adjustments.map((x, j) => (j === i ? { ...x, type: e.target.value as Adjustment["type"] } : x)))
                      }
                    >
                      <option value="earning">Pay</option>
                      <option value="deduction">Take back</option>
                    </Select>
                    <Button type="button" variant="ghost" aria-label="Remove" onClick={() => setAdjustments(adjustments.filter((_, j) => j !== i))}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setAdjustments([...adjustments, { label: "", amount: "", type: "deduction" }])}
                >
                  <Plus className="size-4" /> Add amount
                </Button>
              </fieldset>

              <Field label="Notes (optional)">
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" loading={busy === "calculate"}>
                  {s ? "Recalculate" : "Calculate"}
                </Button>
              </div>
            </form>
          </Card>
        ) : !s ? (
          <Card title="Final settlement">
            <p className="text-sm text-slate-500">
              {employee.status === "TERMINATED"
                ? "This employee has already left."
                : "No settlement yet. Someone with permission to run payroll can start one."}
            </p>
          </Card>
        ) : null}
      </div>

      {s && (
        <div className="lg:col-span-3">
          <Card
            title="Settlement"
            padded={false}
            actions={
              <div className="flex items-center gap-2">
                <SettlementStatusBadge status={s.status} />
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busy === "pdf"}
                  onClick={() =>
                    act("pdf", () => downloadFile(`/final-settlements/${s.id}/pdf`, `final-settlement-${employee.employeeNumber}.pdf`))
                  }
                >
                  <Download className="size-4" /> PDF
                </Button>
              </div>
            }
          >
            <div className="grid grid-cols-2 gap-4 border-b border-slate-100 px-5 py-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-slate-500">Last working day</p>
                <p className="font-medium">{formatDate(s.lastWorkingDay)}</p>
              </div>
              <div>
                <p className="text-slate-500">Reason</p>
                <p className="font-medium">{humanize(s.reason)}</p>
              </div>
              <div>
                <p className="text-slate-500">{Number(s.netAmount) < 0 ? "Employee owes" : "To pay"}</p>
                <p className="text-lg font-semibold">{formatMoney(Math.abs(Number(s.netAmount)), s.currency)}</p>
              </div>
            </div>
            <Table>
              <thead className="bg-slate-50">
                <tr>
                  <Th>Item</Th>
                  <Th className="text-right">Amount</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {s.breakdown.map((l, i) => (
                  <tr key={i}>
                    <Td className="whitespace-normal">{l.label}</Td>
                    <Td className={`text-right tabular-nums ${l.type === "earning" ? "" : "text-red-700"}`}>
                      {l.type === "earning" ? "" : "−"}
                      {formatMoney(l.amount, s.currency)}
                    </Td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-medium">
                  <Td>Total paid</Td>
                  <Td className="text-right tabular-nums">{formatMoney(s.totalEarnings, s.currency)}</Td>
                </tr>
                <tr className="bg-slate-50 font-medium">
                  <Td>Total taken back</Td>
                  <Td className="text-right tabular-nums text-red-700">−{formatMoney(s.totalDeductions, s.currency)}</Td>
                </tr>
                <tr className="bg-slate-50 text-base font-semibold">
                  <Td>{Number(s.netAmount) < 0 ? "Employee owes the company" : "Net to pay"}</Td>
                  <Td className="text-right tabular-nums">{formatMoney(Math.abs(Number(s.netAmount)), s.currency)}</Td>
                </tr>
              </tbody>
            </Table>
            {s.inputs.warnings && s.inputs.warnings.length > 0 && (
              <div className="space-y-2 p-4">
                {s.inputs.warnings.map((w) => (
                  <Alert key={w} tone="info">
                    {w}
                  </Alert>
                ))}
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">
              {s.status === "DRAFT" && canDraft && (
                <Button
                  variant="secondary"
                  loading={busy === "delete"}
                  onClick={() => {
                    if (window.confirm("Delete this draft settlement?")) act("delete", () => api("DELETE", `/final-settlements/${s.id}`));
                  }}
                >
                  Delete draft
                </Button>
              )}
              {s.status === "DRAFT" && canApprove && (
                <Button
                  loading={busy === "approve"}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Approve and end ${employee.firstName}'s employment on ${formatDate(s.lastWorkingDay)}?\n\nTheir status becomes Terminated, their loans are closed and their login stops working.`,
                      )
                    )
                      act("approve", () => api("PATCH", `/final-settlements/${s.id}/approve`));
                  }}
                >
                  Approve
                </Button>
              )}
              {s.status === "APPROVED" && canApprove && (
                <Button loading={busy === "paid"} onClick={() => act("paid", () => api("PATCH", `/final-settlements/${s.id}/mark-paid`))}>
                  Mark as paid
                </Button>
              )}
              {s.status === "PAID" && <p className="text-sm text-slate-500">Paid on {formatDate(s.paidAt)}</p>}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
