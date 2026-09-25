import { Badge, type BadgeTone } from "./ui";
import { humanize } from "@/lib/format";
import type { AttendanceStatus, EmployeeStatus, LeaveStatus, PayrollStatus } from "@/lib/types";

const employeeTones: Record<EmployeeStatus, BadgeTone> = {
  ACTIVE: "green",
  ON_LEAVE: "blue",
  SUSPENDED: "yellow",
  TERMINATED: "red",
};

const leaveTones: Record<LeaveStatus, BadgeTone> = {
  PENDING: "yellow",
  APPROVED: "green",
  REJECTED: "red",
  CANCELLED: "gray",
};

const attendanceTones: Record<AttendanceStatus, BadgeTone> = {
  PRESENT: "green",
  LATE: "yellow",
  HALF_DAY: "yellow",
  ABSENT: "red",
  ON_LEAVE: "blue",
};

const payrollTones: Record<PayrollStatus, BadgeTone> = {
  DRAFT: "gray",
  SUBMITTED: "yellow",
  APPROVED: "green",
  LOCKED: "blue",
};

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  return <Badge tone={employeeTones[status]}>{humanize(status)}</Badge>;
}

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return <Badge tone={leaveTones[status]}>{humanize(status)}</Badge>;
}

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  return <Badge tone={attendanceTones[status]}>{humanize(status)}</Badge>;
}

export function PayrollStatusBadge({ status }: { status: PayrollStatus }) {
  return <Badge tone={payrollTones[status]}>{humanize(status)}</Badge>;
}
