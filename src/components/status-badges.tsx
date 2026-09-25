import { Badge, type BadgeTone } from "./ui";
import { humanize } from "@/lib/format";
import type {
  AttendanceStatus,
  CorrectionStatus,
  EmployeeStatus,
  LeaveStatus,
  PayrollStatus,
  SettlementStatus,
} from "@/lib/types";

const employeeTones: Record<EmployeeStatus, BadgeTone> = {
  ACTIVE: "green",
  ON_LEAVE: "blue",
  SUSPENDED: "yellow",
  TERMINATED: "red",
};

const leaveTones: Record<LeaveStatus, BadgeTone> = {
  PENDING: "yellow",
  FIRST_APPROVED: "blue",
  APPROVED: "green",
  REJECTED: "red",
  CANCELLED: "gray",
};

const correctionTones: Record<CorrectionStatus, BadgeTone> = {
  PENDING: "yellow",
  APPROVED: "green",
  REJECTED: "red",
};

const settlementTones: Record<SettlementStatus, BadgeTone> = {
  DRAFT: "gray",
  APPROVED: "yellow",
  PAID: "green",
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
  return (
    <Badge tone={leaveTones[status]}>{status === "FIRST_APPROVED" ? "Waiting for 2nd approval" : humanize(status)}</Badge>
  );
}

export function CorrectionStatusBadge({ status }: { status: CorrectionStatus }) {
  return <Badge tone={correctionTones[status]}>{humanize(status)}</Badge>;
}

export function SettlementStatusBadge({ status }: { status: SettlementStatus }) {
  return <Badge tone={settlementTones[status]}>{humanize(status)}</Badge>;
}

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  return <Badge tone={attendanceTones[status]}>{humanize(status)}</Badge>;
}

export function PayrollStatusBadge({ status }: { status: PayrollStatus }) {
  return <Badge tone={payrollTones[status]}>{humanize(status)}</Badge>;
}
