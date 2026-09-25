"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { formatDate, formatMinutes, formatTime, fullName, humanize, todayInput } from "@/lib/format";
import type { AttendanceCorrection, AttendanceRecord, AttendanceStatus } from "@/lib/types";
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
import { AttendanceStatusBadge, CorrectionStatusBadge } from "@/components/status-badges";
import { CheckInWidget } from "@/components/check-in-widget";
import { RequirePermission } from "@/components/app-shell";

type Tab = "mine" | "register" | "corrections";

export default function AttendancePage() {
  return (
    <RequirePermission permission="hrm.attendance.read">
      <Attendance />
    </RequirePermission>
  );
}

function Attendance() {
  const { me, can } = useAuth();
  const canManage = can("hrm.attendance.approve");
  const hasEmployee = !!me?.employee;
  const [tab, setTab] = useState<Tab>(hasEmployee ? "mine" : "register");

  const tabs: { id: Tab; label: string }[] = [
    ...(hasEmployee ? [{ id: "mine" as Tab, label: "My attendance" }] : []),
    ...(canManage ? [{ id: "register" as Tab, label: "Daily register" }] : []),
    ...(canManage ? [{ id: "corrections" as Tab, label: "Time corrections" }] : []),
  ];

  return (
    <>
      <PageHeader title="Attendance" />
      {tabs.length > 1 && <Tabs tabs={tabs} value={tab} onChange={setTab} />}
      {tab === "mine" && hasEmployee && <MyAttendance />}
      {tab === "register" && canManage && <Register />}
      {tab === "corrections" && canManage && <CorrectionApprovals />}
      {!hasEmployee && !canManage && (
        <Alert tone="info">Your login isn&apos;t linked to an employee profile yet. Ask HR to link it.</Alert>
      )}
    </>
  );
}

function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

function MyAttendance() {
  const [month, setMonth] = useState(todayInput().slice(0, 7));
  const { from, to } = monthRange(month);
  const history = useApi<AttendanceRecord[]>(`/attendance?from=${from}&to=${to}`);
  const corrections = useApi<AttendanceCorrection[]>("/attendance/corrections");
  const [requesting, setRequesting] = useState(false);

  return (
    <div className="space-y-6">
      <CheckInWidget onChange={history.reload} />
      <Card
        title="History"
        padded={false}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setRequesting(true)}>
              Fix my times
            </Button>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" aria-label="Month" />
          </div>
        }
      >
        {history.loading && !history.data ? (
          <Spinner />
        ) : history.error ? (
          <div className="p-4">
            <Alert>{history.error}</Alert>
          </div>
        ) : !history.data?.length ? (
          <EmptyState title="No attendance this month" />
        ) : (
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <Th>Date</Th>
                <Th>In</Th>
                <Th>Out</Th>
                <Th>Worked</Th>
                <Th>Late</Th>
                <Th>Overtime</Th>
                <Th>Status</Th>
                <Th className="hidden sm:table-cell">Notes</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.data.map((r) => (
                <tr key={r.id}>
                  <Td>{formatDate(r.date)}</Td>
                  <Td>{formatTime(r.checkIn)}</Td>
                  <Td>{formatTime(r.checkOut)}</Td>
                  <Td>{formatMinutes(r.workedMinutes)}</Td>
                  <Td className={r.lateMinutes ? "text-amber-700" : undefined}>{formatMinutes(r.lateMinutes)}</Td>
                  <Td>{formatMinutes(r.overtimeMinutes)}</Td>
                  <Td>
                    <AttendanceStatusBadge status={r.status} />
                  </Td>
                  <Td className="hidden text-slate-500 sm:table-cell">{r.notes ?? ""}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {corrections.data && corrections.data.length > 0 && (
        <Card title="My time corrections" padded={false}>
          <CorrectionTable rows={corrections.data} />
        </Card>
      )}

      <CorrectionForm
        open={requesting}
        onClose={() => setRequesting(false)}
        onSaved={() => {
          setRequesting(false);
          corrections.reload();
        }}
      />
    </div>
  );
}

function CorrectionForm({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(todayInput());
  const [checkInTime, setCheckInTime] = useState("");
  const [checkOutTime, setCheckOutTime] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api("POST", "/attendance/corrections", {
        date,
        reason,
        ...(checkInTime && { checkInTime }),
        ...(checkOutTime && { checkOutTime }),
      });
      setCheckInTime("");
      setCheckOutTime("");
      setReason("");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Fix my check-in / check-out">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600">
          Forgot to check in or out? Tell us the real times. Your manager or HR will approve it.
        </p>
        {error && <Alert>{error}</Alert>}
        <Field label="Day">
          <Input type="date" required value={date} max={todayInput()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Checked in at" hint="Leave empty if it was right">
            <Input type="time" value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} />
          </Field>
          <Field label="Checked out at" hint="Earlier than check-in = next day">
            <Input type="time" value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)} />
          </Field>
        </div>
        <Field label="Reason">
          <Textarea required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={!checkInTime && !checkOutTime}>
            Send for approval
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CorrectionTable({
  rows,
  showEmployee,
  onDecide,
  busyId,
}: {
  rows: AttendanceCorrection[];
  showEmployee?: boolean;
  onDecide?: (id: string, approve: boolean) => void;
  busyId?: string | null;
}) {
  return (
    <Table>
      <thead className="bg-slate-50">
        <tr>
          {showEmployee && <Th>Employee</Th>}
          <Th>Day</Th>
          <Th>In</Th>
          <Th>Out</Th>
          <Th>Reason</Th>
          <Th>Status</Th>
          {onDecide && <Th />}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((c) => (
          <tr key={c.id}>
            {showEmployee && <Td className="font-medium text-slate-900">{fullName(c.employee)}</Td>}
            <Td>{formatDate(c.date)}</Td>
            <Td>{formatTime(c.checkIn)}</Td>
            <Td>{formatTime(c.checkOut)}</Td>
            <Td className="max-w-xs truncate whitespace-normal text-slate-600">{c.reason}</Td>
            <Td>
              <CorrectionStatusBadge status={c.status} />
            </Td>
            {onDecide && (
              <Td className="text-right">
                {c.status === "PENDING" && (
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="secondary" disabled={busyId === c.id} onClick={() => onDecide(c.id, false)}>
                      Reject
                    </Button>
                    <Button size="sm" loading={busyId === c.id} onClick={() => onDecide(c.id, true)}>
                      Approve
                    </Button>
                  </div>
                )}
              </Td>
            )}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function CorrectionApprovals() {
  const [status, setStatus] = useState("PENDING");
  const list = useApi<AttendanceCorrection[]>(`/attendance/corrections${status ? `?status=${status}` : ""}`);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(id: string, approve: boolean) {
    setBusyId(id);
    setError(null);
    try {
      await api("PATCH", `/attendance/corrections/${id}/${approve ? "approve" : "reject"}`);
      await list.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card
      title="Time corrections"
      padded={false}
      actions={
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40" aria-label="Show">
          <option value="PENDING">Waiting</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="">All</option>
        </Select>
      }
    >
      {error && (
        <div className="p-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {list.loading && !list.data ? (
        <Spinner />
      ) : !list.data?.length ? (
        <EmptyState title="Nothing here" description="When someone asks to fix their check-in times, it shows up here." />
      ) : (
        <CorrectionTable rows={list.data} showEmployee onDecide={decide} busyId={busyId} />
      )}
    </Card>
  );
}

interface RegisterResponse {
  date: string;
  rows: {
    employee: { id: string; employeeNumber: string; firstName: string; lastName: string; designation: string };
    record: AttendanceRecord | null;
  }[];
}

const STATUSES: AttendanceStatus[] = ["PRESENT", "LATE", "HALF_DAY", "ABSENT", "ON_LEAVE"];

function Register() {
  const [date, setDate] = useState(todayInput());
  const register = useApi<RegisterResponse>(`/attendance/register?date=${date}`);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function mark(employeeId: string, status: AttendanceStatus) {
    setSavingId(employeeId);
    setError(null);
    try {
      await api("POST", "/attendance/mark", { employeeId, date, status });
      await register.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSavingId(null);
    }
  }

  const rows = register.data?.rows ?? [];
  const present = rows.filter((r) => r.record?.checkIn || r.record?.status === "PRESENT" || r.record?.status === "LATE").length;

  return (
    <Card
      title={`${present} of ${rows.length} present`}
      padded={false}
      actions={<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" aria-label="Date" />}
    >
      <p className="border-b border-slate-100 px-5 py-2 text-xs text-slate-500">
        Days marked Absent or Half day are deducted from pay when payroll runs. Unmarked days are not.
      </p>
      {error && (
        <div className="p-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {register.loading && !register.data ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState title="No active employees" />
      ) : (
        <Table>
          <thead className="bg-slate-50">
            <tr>
              <Th>Employee</Th>
              <Th>In</Th>
              <Th>Out</Th>
              <Th>Late</Th>
              <Th>Overtime</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ employee, record }) => (
              <tr key={employee.id}>
                <Td>
                  <p className="font-medium text-slate-900">
                    {employee.firstName} {employee.lastName}
                  </p>
                  <p className="text-xs text-slate-500">{employee.designation}</p>
                </Td>
                <Td>{formatTime(record?.checkIn)}</Td>
                <Td>{formatTime(record?.checkOut)}</Td>
                <Td className={record?.lateMinutes ? "text-amber-700" : undefined}>{formatMinutes(record?.lateMinutes)}</Td>
                <Td>{formatMinutes(record?.overtimeMinutes)}</Td>
                <Td>
                  <Select
                    value={record?.status ?? ""}
                    disabled={savingId === employee.id}
                    onChange={(e) => mark(employee.id, e.target.value as AttendanceStatus)}
                    className="w-36"
                    aria-label={`Status for ${employee.firstName}`}
                  >
                    {!record && <option value="">Not marked</option>}
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {humanize(s)}
                      </option>
                    ))}
                  </Select>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
