"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { formatDate, formatTime, humanize, todayInput } from "@/lib/format";
import type { AttendanceRecord, AttendanceStatus } from "@/lib/types";
import { Alert, Card, EmptyState, Input, PageHeader, Select, Spinner, Table, Tabs, Td, Th } from "@/components/ui";
import { AttendanceStatusBadge } from "@/components/status-badges";
import { CheckInWidget } from "@/components/check-in-widget";
import { RequirePermission } from "@/components/app-shell";

type Tab = "mine" | "register";

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
  ];

  return (
    <>
      <PageHeader title="Attendance" />
      {tabs.length > 1 && <Tabs tabs={tabs} value={tab} onChange={setTab} />}
      {tab === "mine" && hasEmployee && <MyAttendance />}
      {tab === "register" && canManage && <Register />}
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

  return (
    <div className="space-y-6">
      <CheckInWidget onChange={history.reload} />
      <Card
        title="History"
        padded={false}
        actions={<Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" aria-label="Month" />}
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
    </div>
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
