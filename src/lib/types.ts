// Shapes returned by quscer-hrm-backend. Prisma Decimal fields arrive as
// strings in JSON, hence `number | string` on money values.

export type Money = number | string;

export interface Me {
  user: { id: string; email: string; firstName: string; lastName: string };
  organization: { id: string; name: string; currency: string; timezone: string };
  // Every company this login can open (more than one for e.g. outsourced HR).
  companies: { id: string; name: string }[];
  roles: string[];
  permissions: string[];
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    designation: string;
  } | null;
}

export type EmployeeStatus = "ACTIVE" | "ON_LEAVE" | "SUSPENDED" | "TERMINATED";
export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN";

export interface Branch {
  id: string;
  name: string;
  countryCode: string;
  regionCode: string | null;
  timezone: string;
  isActive: boolean;
  _count?: { employees: number };
}

export interface Department {
  id: string;
  name: string;
  branchId: string | null;
  parentId: string | null;
  branch?: { id: string; name: string } | null;
  _count?: { employees: number };
}

export interface CostCentre {
  id: string;
  code: string;
  name: string;
  branchId: string | null;
  branch?: { id: string; name: string } | null;
}

export interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
  branchId: string | null;
}

export interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  designation: string;
  status: EmployeeStatus;
  employmentType: EmploymentType;
  dateOfJoining: string;
  dateOfBirth: string | null;
  probationEndDate: string | null;
  confirmedAt: string | null;
  contractEndDate: string | null;
  countryCode: string | null;
  regionCode: string | null;
  branchId: string | null;
  departmentId: string | null;
  managerId: string | null;
  userId: string | null;
  shiftId: string | null;
  exitDate: string | null;
  branch?: Branch | null;
  department?: Department | null;
  shift?: Shift | null;
}

export interface EmployeeProfile extends Employee {
  manager: { id: string; firstName: string; lastName: string } | null;
  directReports: { id: string; firstName: string; lastName: string; designation: string }[];
  emergencyContacts: { id: string; name: string; relationship: string; phone: string; isPrimary: boolean }[];
  documents: EmployeeDocument[];
  bankDetail: {
    id: string;
    bankName: string;
    accountTitle: string;
    accountNumberLast4: string | null;
    branchCode: string | null;
  } | null;
}

// Either an uploaded file (fileName set) or a link to one kept elsewhere.
export interface EmployeeDocument {
  id: string;
  category: string;
  fileUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  expiryDate: string | null;
  uploadedAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "ON_LEAVE";

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: AttendanceStatus;
  source: "MANUAL" | "APP_CHECKIN" | "BIOMETRIC";
  notes: string | null;
  lateMinutes: number;
  earlyExitMinutes: number;
  overtimeMinutes: number;
  workedMinutes: number | null;
}

export type CorrectionStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface AttendanceCorrection {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  reason: string;
  status: CorrectionStatus;
  createdAt: string;
  employee: { id: string; firstName: string; lastName: string; employeeNumber: string };
}

export interface LeaveType {
  id: string;
  name: string;
  isPaid: boolean;
  defaultAnnualDays: number;
  accrual: "ANNUAL" | "MONTHLY";
  maxCarryForwardDays: number;
  isEncashable: boolean;
  allowNegativeBalance: boolean;
}

export type LeaveStatus = "PENDING" | "FIRST_APPROVED" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: LeaveStatus;
  createdAt: string;
  leaveType: LeaveType;
  employee: { id: string; firstName: string; lastName: string; employeeNumber: string };
}

export interface LeaveBalance {
  leaveType: LeaveType;
  year: number;
  allocatedDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  isManualAllocation: boolean;
}

export type SalaryComponentType = "EARNING" | "DEDUCTION" | "EMPLOYER_CONTRIBUTION";

export interface SalaryStructure {
  id: string;
  currency: string;
  basicSalary: Money;
  effectiveFrom: string;
  components: {
    id: string;
    amount: Money;
    component: { id: string; name: string; type: SalaryComponentType; isTaxable: boolean };
  }[];
}

export interface Loan {
  id: string;
  principal: Money;
  installmentAmount: Money;
  remainingBalance: Money;
  status: "ACTIVE" | "CLOSED";
  startDate: string;
}

export type PayrollStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "LOCKED";

export interface PayrollRunSummary {
  id: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: PayrollStatus;
  employeeCount: number;
  totalNet: number;
  currency: string | null;
}

export interface BreakdownLine {
  label: string;
  type: "earning" | "deduction" | "statutory_deduction" | "loan_deduction" | "employer_contribution";
  amount: number;
  sourceRef?: string;
}

export interface PayrollLineItem {
  id: string;
  employeeId: string;
  currency: string;
  grossSalary: Money;
  totalEarnings: Money;
  totalDeductions: Money;
  netSalary: Money;
  breakdown: BreakdownLine[];
  employee: { id: string; firstName: string; lastName: string; employeeNumber: string };
}

export interface PayrollRunDetail {
  id: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: PayrollStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  lineItems: PayrollLineItem[];
}

export interface PayrollWarnings {
  skippedNoSalaryStructure: string[];
  skippedNoJurisdiction: string[];
  skippedNotYetJoined: string[];
  negativeNetPay: string[];
}

export interface MyPayslip {
  runId: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  currency: string;
  grossSalary: Money;
  totalDeductions: Money;
  netSalary: Money;
}

export interface Role {
  id: string;
  name: string;
  isSystemRole: boolean;
  permissions: { permission: { key: string; description: string | null } }[];
}

export interface AppUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  hasOtherCompanies: boolean;
  roles: { id: string; name: string }[];
  employee: { id: string; firstName: string; lastName: string; employeeNumber: string } | null;
}

export interface OrgSettings {
  id: string;
  name: string;
  localeSettings: {
    defaultCountryCode: string;
    defaultCurrency: string;
    defaultTimezone: string;
    weekendDays: number[];
    leaveApprovalSteps: number;
    lateGraceMinutes: number;
    birthdayPostsEnabled: boolean;
  } | null;
}

export type TodayStatus = "PRESENT" | "LATE" | "HALF_DAY" | "ABSENT" | "ON_LEAVE" | "OFF" | "NOT_IN";

export interface TodayCounts {
  total: number;
  present: number;
  late: number;
  absent: number;
  onLeave: number;
  notIn: number;
  off: number;
  attendanceRate: number | null;
}

export interface TodayPerson {
  id: string;
  firstName: string;
  lastName: string;
  designation: string;
  employeeNumber: string;
  status: TodayStatus;
  checkIn: string | null;
}

export interface UpcomingLeaveItem {
  id: string;
  employee: { id: string; firstName: string; lastName: string; designation: string; employeeNumber: string };
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  status: LeaveStatus;
}

export interface ActivityItem {
  kind: string;
  text: string;
  at: string;
}

export interface DashboardSummary {
  today: string;
  activeEmployees: number;
  activeEmployeesMonthAgo: number;
  attendance: TodayCounts;
  people: TodayPerson[];
  upcomingLeave: UpcomingLeaveItem[];
  pendingApprovals: { leave: number; corrections: number; settlements: number };
  expiringDocuments: {
    id: string;
    category: string;
    expiryDate: string;
    employee: { id: string; firstName: string; lastName: string };
  }[];
  latestPayrollRun: {
    id: string;
    periodStart: string;
    periodEnd: string;
    payDate: string;
    status: PayrollStatus;
    employeeCount: number;
    totalNet: number;
    currency: string | null;
  } | null;
  activity: ActivityItem[];
}

export interface TeamSummary {
  today: string;
  counts: TodayCounts;
  people: TodayPerson[];
  upcomingLeave: UpcomingLeaveItem[];
  pendingApprovals: { leave: number; corrections: number };
}

export interface MySummary {
  activity: ActivityItem[];
  pendingRequests: { leave: number; corrections: number };
}

export interface CompanyCard {
  id: string;
  name: string;
  activeEmployees: number;
  presentToday: number;
  onLeaveToday: number;
  attendanceRate: number | null;
  pendingApprovals: number;
  latestPayrollRun: { status: PayrollStatus; periodStart: string } | null;
}

export type ExitReason = "RESIGNATION" | "TERMINATION" | "END_OF_CONTRACT" | "RETIREMENT" | "OTHER";
export type SettlementStatus = "DRAFT" | "APPROVED" | "PAID";

export interface SettlementLine {
  label: string;
  type: "earning" | "deduction" | "statutory_deduction" | "loan_deduction";
  amount: number;
}

export interface FinalSettlement {
  id: string;
  employeeId: string;
  lastWorkingDay: string;
  reason: ExitReason;
  status: SettlementStatus;
  currency: string;
  totalEarnings: Money;
  totalDeductions: Money;
  netAmount: Money;
  breakdown: SettlementLine[];
  inputs: {
    includeGratuity?: boolean;
    noticeDaysInLieu?: number;
    noticeDaysShort?: number;
    adjustments?: { label: string; amount: number; type: "earning" | "deduction" }[];
    notes?: string;
    warnings?: string[];
  };
  approvedAt: string | null;
  paidAt: string | null;
}

export type FeedPostKind = "POST" | "ANNOUNCEMENT" | "BIRTHDAY";
export type Person = { id: string; firstName: string; lastName: string };

export interface FeedPost {
  id: string;
  kind: FeedPostKind;
  body: string;
  isPinned: boolean;
  createdAt: string;
  author: Person | null;
  subjectEmployee: Person | null;
  imageIds: string[];
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  canDelete: boolean;
  canPin: boolean;
}

export interface FeedPage {
  pinned: FeedPost[];
  items: FeedPost[];
  nextCursor: string | null;
  canAnnounce: boolean;
}

export interface FeedComment {
  id: string;
  body: string;
  createdAt: string;
  author: Person;
  canDelete: boolean;
}
