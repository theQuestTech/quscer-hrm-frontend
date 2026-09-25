"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { formatDate, fullName, todayInput } from "@/lib/format";
import type { Employee, LeaveBalance, LeaveRequest, LeaveType, Paginated } from "@/lib/types";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Table,
  Tabs,
  Td,
  Textarea,
  Th,
} from "@/components/ui";
import { LeaveStatusBadge } from "@/components/status-badges";
import { RequirePermission } from "@/components/app-shell";

type Tab = "mine" | "approvals" | "balances";

function urlParam(key: string) {
  return typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(key);
}

export default function LeavePage() {
  return (
    <RequirePermission permission="hrm.leave.read">
      <Suspense>
        <Leave />
      </Suspense>
    </RequirePermission>
  );
}

function Leave() {
  const { me, can } = useAuth();
  const params = useSearchParams();
  const canApprove = can("hrm.leave.approve");
  const hasEmployee = !!me?.employee;
  const tabs: { id: Tab; label: string }[] = [
    ...(hasEmployee ? [{ id: "mine" as Tab, label: "My leave" }] : []),
    ...(canApprove ? [{ id: "approvals" as Tab, label: "Approvals" }, { id: "balances" as Tab, label: "Balances" }] : []),
  ];
  const requested = params.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(tabs.find((t) => t.id === requested)?.id ?? tabs[0]?.id ?? "mine");

  return (
    <>
      <PageHeader title="Leave" />
      {tabs.length > 1 && <Tabs tabs={tabs} value={tab} onChange={setTab} />}
      {tab === "mine" && hasEmployee && <MyLeave />}
      {tab === "approvals" && canApprove && <Approvals />}
      {tab === "balances" && canApprove && <Balances />}
      {tabs.length === 0 && <Alert tone="info">Your login isn&apos;t linked to an employee profile yet. Ask HR to link it.</Alert>}
    </>
  );
}

function MyLeave() {
  const year = new Date().getFullYear();
  const balances = useApi<LeaveBalance[]>(`/leave-balances?year=${year}`);
  const requests = useApi<LeaveRequest[]>("/leave-requests");
  // ?new=1 (the dashboard's "Apply for Leave") opens the form straight away.
  const [open, setOpen] = useState(() => urlParam("new") === "1");
  const [error, setError] = useState<string | null>(null);

  async function cancel(id: string) {
    setError(null);
    try {
      await api("PATCH", `/leave-requests/${id}/cancel`);
      requests.reload();
      balances.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel");
    }
  }

  return (
    <div className="space-y-6">
      <Card
        title={`My balance · ${year}`}
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Request leave
          </Button>
        }
      >
        {balances.loading && !balances.data ? (
          <Spinner />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {balances.data?.map((b) => (
              <div key={b.leaveType.id} className="rounded-lg bg-slate-50 p-4">
                <p className="text-sm text-slate-500">{b.leaveType.name}</p>
                {b.leaveType.isPaid ? (
                  <>
                    <p className="mt-1 text-2xl font-semibold">{b.remainingDays}</p>
                    <p className="text-xs text-slate-500">
                      of {b.allocatedDays} days left · {b.usedDays} used
                      {b.pendingDays > 0 && ` · ${b.pendingDays} waiting`}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-2xl font-semibold">{b.usedDays}</p>
                    <p className="text-xs text-slate-500">days taken (deducted from pay)</p>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="My requests" padded={false}>
        {error && (
          <div className="p-4">
            <Alert>{error}</Alert>
          </div>
        )}
        <RequestsTable
          requests={requests.data}
          loading={requests.loading}
          showEmployee={false}
          actions={(r) =>
            (r.status === "PENDING" || r.status === "FIRST_APPROVED") && (
              <Button size="sm" variant="ghost" onClick={() => cancel(r.id)}>
                Cancel
              </Button>
            )
          }
        />
      </Card>

      <RequestModal
        open={open}
        onClose={() => setOpen(false)}
        onDone={() => {
          setOpen(false);
          requests.reload();
        }}
      />
    </div>
  );
}

function RequestModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const types = useApi<LeaveType[]>("/leave-types");
  const [form, setForm] = useState({ leaveTypeId: "", startDate: todayInput(), endDate: todayInput(), reason: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const leaveTypeId = form.leaveTypeId || types.data?.[0]?.id || "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api("POST", "/leave-requests", { ...form, leaveTypeId, reason: form.reason || undefined });
      setForm({ leaveTypeId: "", startDate: todayInput(), endDate: todayInput(), reason: "" });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Request leave">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Type">
          <Select required value={leaveTypeId} onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })}>
            {types.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.isPaid ? "" : " (unpaid)"}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <Input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value, endDate: e.target.value > form.endDate ? e.target.value : form.endDate })} />
          </Field>
          <Field label="To">
            <Input type="date" required min={form.startDate} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </Field>
        </div>
        <p className="text-xs text-slate-500">Weekends and company holidays aren&apos;t counted.</p>
        <Field label="Reason (optional)">
          <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            Submit request
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RequestsTable({
  requests,
  loading,
  showEmployee,
  actions,
}: {
  requests: LeaveRequest[] | null;
  loading: boolean;
  showEmployee: boolean;
  actions?: (r: LeaveRequest) => React.ReactNode;
}) {
  if (loading && !requests) return <Spinner />;
  if (!requests?.length) return <EmptyState title="No leave requests" />;
  return (
    <Table>
      <thead className="bg-slate-50">
        <tr>
          {showEmployee && <Th>Employee</Th>}
          <Th>Type</Th>
          <Th>Dates</Th>
          <Th>Days</Th>
          <Th className="hidden md:table-cell">Reason</Th>
          <Th>Status</Th>
          {actions && <Th />}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {requests.map((r) => (
          <tr key={r.id}>
            {showEmployee && <Td className="font-medium text-slate-900">{fullName(r.employee)}</Td>}
            <Td>{r.leaveType.name}</Td>
            <Td>
              {formatDate(r.startDate)}
              {r.endDate !== r.startDate && ` – ${formatDate(r.endDate)}`}
            </Td>
            <Td>{r.days}</Td>
            <Td className="hidden max-w-xs truncate text-slate-500 md:table-cell">{r.reason ?? ""}</Td>
            <Td>
              <LeaveStatusBadge status={r.status} />
            </Td>
            {actions && <Td className="text-right">{actions(r)}</Td>}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function Approvals() {
  const { me } = useAuth();
  // "OPEN" = still waiting on someone: new requests and ones with only the
  // first of two approvals.
  const [status, setStatus] = useState("OPEN");
  const all = useApi<LeaveRequest[]>(`/leave-requests${status && status !== "OPEN" ? `?status=${status}` : ""}`);
  const requests = {
    ...all,
    data: status === "OPEN" ? all.data?.filter((r) => r.status === "PENDING" || r.status === "FIRST_APPROVED") ?? null : all.data,
  };
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, action: "approve" | "reject" | "cancel") {
    setBusyId(id);
    setError(null);
    try {
      await api("PATCH", `/leave-requests/${id}/${action}`);
      await requests.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card
      title="Requests"
      padded={false}
      actions={
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40" aria-label="Status">
          <option value="OPEN">Waiting</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="">All</option>
        </Select>
      }
    >
      {error && (
        <div className="p-4">
          <Alert>{error}</Alert>
        </div>
      )}
      <RequestsTable
        requests={requests.data}
        loading={requests.loading}
        showEmployee
        actions={(r) => {
          if (r.employeeId === me?.employee?.id) return <span className="text-xs text-slate-400">Your own</span>;
          if (r.status === "PENDING" || r.status === "FIRST_APPROVED")
            return (
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="secondary" loading={busyId === r.id} onClick={() => act(r.id, "reject")}>
                  Reject
                </Button>
                <Button size="sm" loading={busyId === r.id} onClick={() => act(r.id, "approve")}>
                  {r.status === "FIRST_APPROVED" ? "Final approve" : "Approve"}
                </Button>
              </div>
            );
          if (r.status === "APPROVED")
            return (
              <Button size="sm" variant="ghost" loading={busyId === r.id} onClick={() => act(r.id, "cancel")}>
                Cancel
              </Button>
            );
          return null;
        }}
      />
    </Card>
  );
}

function Balances() {
  const year = new Date().getFullYear();
  const employees = useApi<Paginated<Employee>>("/employees?pageSize=100");
  const [employeeId, setEmployeeId] = useState("");
  const selected = employeeId || employees.data?.items[0]?.id || "";
  const balances = useApi<LeaveBalance[]>(selected ? `/leave-balances?employeeId=${selected}&year=${year}` : null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  // A number sets the allocation by hand; null goes back to the leave
  // type's rules (accrual, proration, carry-forward).
  async function save(leaveTypeId: string, reset = false) {
    setMessage(null);
    try {
      await api("PUT", "/leave-balances", {
        employeeId: selected,
        leaveTypeId,
        year,
        allocatedDays: reset ? null : Number(edits[leaveTypeId]),
      });
      setEdits((e) => {
        const next = { ...e };
        delete next[leaveTypeId];
        return next;
      });
      setMessage({ tone: "success", text: reset ? "Back to the automatic amount" : "Allocation saved" });
      balances.reload();
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Could not save" });
    }
  }

  return (
    <Card
      title={`Allocations · ${year}`}
      padded={false}
      actions={
        <Select value={selected} onChange={(e) => setEmployeeId(e.target.value)} className="w-56" aria-label="Employee">
          {employees.data?.items.map((e) => (
            <option key={e.id} value={e.id}>
              {e.firstName} {e.lastName}
            </option>
          ))}
        </Select>
      }
    >
      <p className="border-b border-slate-100 px-5 py-2 text-xs text-slate-500">
        Days are worked out from each leave type&apos;s rules (set in Settings → Leave types): cut down for people who joined this
        year, earned month by month if set that way, plus days carried over from last year. Type a number to override it for
        one person.
      </p>
      {message && (
        <div className="p-4">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}
      {!selected ? (
        <EmptyState title="No employees yet" />
      ) : balances.loading && !balances.data ? (
        <Spinner />
      ) : (
        <Table>
          <thead className="bg-slate-50">
            <tr>
              <Th>Leave type</Th>
              <Th>Allocated</Th>
              <Th>Used</Th>
              <Th>Waiting</Th>
              <Th>Remaining</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {balances.data?.map((b) => (
              <tr key={b.leaveType.id}>
                <Td className="font-medium text-slate-900">{b.leaveType.name}</Td>
                <Td>
                  <Input
                    type="number"
                    min={0}
                    step="0.5"
                    className="w-24"
                    value={edits[b.leaveType.id] ?? String(b.allocatedDays)}
                    onChange={(e) => setEdits({ ...edits, [b.leaveType.id]: e.target.value })}
                    aria-label={`${b.leaveType.name} allocation`}
                  />
                </Td>
                <Td>{b.usedDays}</Td>
                <Td>{b.pendingDays || "—"}</Td>
                <Td>{b.remainingDays}</Td>
                <Td className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {b.isManualAllocation && edits[b.leaveType.id] === undefined && (
                      <>
                        <span className="text-xs text-slate-500">Set by hand</span>
                        <Button size="sm" variant="ghost" onClick={() => save(b.leaveType.id, true)}>
                          Use automatic
                        </Button>
                      </>
                    )}
                    {edits[b.leaveType.id] !== undefined && (
                      <Button size="sm" onClick={() => save(b.leaveType.id)}>
                        Save
                      </Button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
