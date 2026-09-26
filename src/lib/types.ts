// Shapes returned by quscer-hrm-backend. Prisma Decimal fields arrive as
// strings in JSON, hence `number | string` on money values.

export type Money = number | string;

export interface Me {
  user: { id: string; email: string; firstName: string; lastName: string };
  organization: {
    id: string;
    name: string;
    currency: string;
    timezone: string;
    // Optional modules this company uses ("performance", "training", "recruitment").
    modules: string[];
    kpiScoring: KpiScoring;
  };
  // Not HR, but interviewing / hiring for a job, or with joining tasks.
  involvement: { recruiting: boolean; onboarding: boolean };
  // Every company this login can open (more than one for e.g. outsourced HR).
  companies: { id: string; name: string }[];
  roles: string[];
  permissions: string[];
  // Set while Quscer support is looking at HRM as this person (read-only).
  supportView?: { agentName: string; expiresAt: string } | null;
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    designation: string;
    photoUpdatedAt: string | null;
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
  photoUpdatedAt: string | null;
  fatherName: string | null;
  cnic: string | null;
  gender: string | null;
  maritalStatus: string | null;
  bloodGroup: string | null;
  personalEmail: string | null;
  address: string | null;
  city: string | null;
  // Attendance: number on the attendance machine; own check-in rules (null = company default)
  machineUserId: string | null;
  checkInMethod: "APP" | "MACHINE" | "BOTH" | null;
  requireOfficeNetwork: boolean | null;
  requireOfficeLocation: boolean | null;
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
  // Where an app check-in/out happened
  checkInInfo?: { ip?: string; network?: string; place?: string; latitude?: number; longitude?: number } | null;
  checkOutInfo?: { ip?: string; network?: string; place?: string; latitude?: number; longitude?: number } | null;
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
  careersSlug: string | null;
  localeSettings: {
    defaultCountryCode: string;
    defaultCurrency: string;
    defaultTimezone: string;
    weekendDays: number[];
    leaveApprovalSteps: number;
    lateGraceMinutes: number;
    birthdayPostsEnabled: boolean;
    enabledModules: string[];
    kpiScoring: KpiScoring;
    selfReviewEnabled: boolean;
    defaultCheckInMethod: "APP" | "MACHINE" | "BOTH";
    defaultRequireOfficeNetwork: boolean;
    defaultRequireOfficeLocation: boolean;
    emailNotificationsEnabled: boolean;
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
  photoUpdatedAt: string | null;
  status: TodayStatus;
  checkIn: string | null;
}

export interface UpcomingLeaveItem {
  id: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    designation: string;
    employeeNumber: string;
    photoUpdatedAt?: string | null;
  };
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
// A person as the feed returns them, with their photo in this company.
export type Person = {
  id: string;
  firstName: string;
  lastName: string;
  photo?: { employeeId: string; photoUpdatedAt: string } | null;
};

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

// --- Performance -------------------------------------------------------------

export type KpiScoring = "RATING" | "TARGET" | "BOTH";
export type KpiMeasure = "RATING" | "TARGET";
export type ReviewStage = "GOALS" | "SELF" | "MANAGER" | "DONE";
export type CycleStatus = "DRAFT" | "ACTIVE" | "CLOSED";

export interface KpiTemplate {
  id: string;
  name: string;
  description: string | null;
  measure: KpiMeasure;
  unit: string | null;
  defaultTarget: number | null;
  defaultWeight: number;
  higherIsBetter: boolean;
  auto: "ATTENDANCE" | null;
  isActive: boolean;
}

export interface CycleSummary {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  status: CycleStatus;
  reviewCount: number;
  doneCount: number;
  averageScore: number | null;
  byStage: Record<ReviewStage, number>;
}

type ReviewPerson = {
  id: string;
  firstName: string;
  lastName: string;
  designation: string;
  employeeNumber: string;
  photoUpdatedAt: string | null;
};

export interface CycleDetail extends CycleSummary {
  reviews: {
    id: string;
    stage: ReviewStage;
    finalScore: number | null;
    band: string | null;
    employee: ReviewPerson;
    reviewer: { id: string; firstName: string; lastName: string } | null;
  }[];
}

export interface ReviewListItem {
  id: string;
  stage: ReviewStage;
  finalScore: number | null;
  band: string | null;
  acknowledgedAt: string | null;
  cycle: { id: string; name: string; status: CycleStatus; periodStart: string; periodEnd: string };
  employee: ReviewPerson;
}

export interface ReviewKpi {
  id: string;
  name: string;
  measure: KpiMeasure;
  unit: string | null;
  target: number | null;
  weight: number;
  higherIsBetter: boolean;
  auto: "ATTENDANCE" | null;
  actual: number | null;
  selfRating: number | null;
  managerRating: number | null;
  selfNote: string | null;
  managerNote: string | null;
  score: number | null;
}

export interface ReviewDetail {
  id: string;
  stage: ReviewStage;
  cycle: { id: string; name: string; status: CycleStatus; periodStart: string; periodEnd: string };
  employee: ReviewPerson;
  reviewer: { id: string; firstName: string; lastName: string } | null;
  selfComment: string | null;
  managerComment: string | null;
  finalScore: number | null;
  band: string | null;
  previewScore: number | null;
  selfSubmittedAt: string | null;
  completedAt: string | null;
  acknowledgedAt: string | null;
  kpis: ReviewKpi[];
  settings: { scoring: KpiScoring; selfReview: boolean };
  can: { setGoals: boolean; selfReview: boolean; managerReview: boolean; acknowledge: boolean };
}

// --- Recruitment ---------------------------------------------------------------

export type JobStatus = "DRAFT" | "OPEN" | "CLOSED";
export type ApplicationStage = "APPLIED" | "SCREENING" | "INTERVIEW" | "OFFER" | "HIRED" | "REJECTED";
export type OfferStatus = "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED";
export type InterviewStatus = "SCHEDULED" | "DONE" | "CANCELLED";

type PersonRef = { id: string; firstName: string; lastName: string; designation: string; photoUpdatedAt: string | null };

export interface Job {
  id: string;
  title: string;
  departmentId: string | null;
  branchId: string | null;
  employmentType: EmploymentType | null;
  location: string | null;
  description: string;
  requirements: string | null;
  salaryRange: string | null;
  openings: number;
  closesAt: string | null;
  status: JobStatus;
  hiringManagerEmployeeId: string | null;
  createdAt: string;
  department: string | null;
  hiringManager: PersonRef | null;
}

export interface JobSummary extends Job {
  byStage: Record<ApplicationStage, number>;
  total: number;
  hired: number;
}

export interface CandidateListItem {
  id: string;
  jobId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string | null;
  stage: ApplicationStage;
  source: string;
  createdAt: string;
  cvFileName: string | null;
  hiredEmployeeId: string | null;
  averageRating: number | null;
  job?: { id: string; title: string };
}

export interface JobDetail extends Job {
  canManage: boolean;
  careersSlug: string | null;
  applications: CandidateListItem[];
}

export interface InterviewItem {
  id: string;
  applicationId: string;
  scheduledAt: string;
  durationMinutes: number;
  mode: "IN_PERSON" | "PHONE" | "VIDEO";
  location: string | null;
  interviewerEmployeeId: string | null;
  interviewer: PersonRef | null;
  status: InterviewStatus;
  rating: number | null;
  recommendation: "HIRE" | "MAYBE" | "NO_HIRE" | null;
  feedback: string | null;
  canGiveFeedback?: boolean;
  application?: { id: string; firstName: string; lastName: string; job: { id: string; title: string } };
}

export interface CandidateDetail extends CandidateListItem {
  currentCompany: string | null;
  expectedSalary: number | null;
  noticePeriodDays: number | null;
  coverNote: string | null;
  rejectReason: string | null;
  notes: string | null;
  cvMimeType: string | null;
  job: { id: string; title: string; departmentId: string | null; branchId: string | null; employmentType: EmploymentType | null };
  offer: { designation: string; salary: number; joiningDate: string; notes: string | null; status: OfferStatus; sentAt: string | null } | null;
  interviews: InterviewItem[];
  timeline: { id: string; eventType: string; createdAt: string; metadata: Record<string, unknown>; actor: { firstName: string; lastName: string } | null }[];
  can: { manage: boolean; hire: boolean };
}

// --- Onboarding ----------------------------------------------------------------

export type OnboardingAssignee = "HR" | "MANAGER" | "EMPLOYEE";

export interface OnboardingTemplate {
  id: string;
  title: string;
  description: string | null;
  assignee: OnboardingAssignee;
  dueDays: number;
  isActive: boolean;
}

export interface OnboardingTask {
  id: string;
  employeeId: string;
  title: string;
  description: string | null;
  assignee: OnboardingAssignee;
  dueDate: string;
  doneAt: string | null;
  canTick?: boolean;
  forMe?: boolean;
  employee?: PersonRef & { dateOfJoining: string };
}

export interface OnboardingOverviewItem {
  employee: PersonRef & { dateOfJoining: string; managerId: string | null };
  total: number;
  done: number;
  overdue: number;
}

export interface EmployeeOnboarding {
  employee: PersonRef & { dateOfJoining: string; managerId: string | null };
  canManage: boolean;
  tasks: OnboardingTask[];
}

// --- Training ------------------------------------------------------------------

export type TrainingDelivery = "CLASSROOM" | "ONLINE" | "ON_THE_JOB";
export type EnrolmentStatus = "ENROLLED" | "COMPLETED" | "NO_SHOW" | "CANCELLED";
export type CertificateState = "NONE" | "VALID" | "EXPIRING" | "EXPIRED";
export type TrainingRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "BOOKED";

export interface TrainingCourse {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  provider: string | null;
  delivery: TrainingDelivery;
  durationHours: number | null;
  costPerPerson?: number | null;
  validityMonths: number | null;
  isActive: boolean;
}

type CourseRef = Pick<TrainingCourse, "id" | "title" | "category" | "delivery" | "validityMonths" | "durationHours">;
type SessionRef = { id: string; startsAt: string; endsAt: string; location: string | null; trainer: string | null; status: "PLANNED" | "DONE" | "CANCELLED" };
type TraineeRef = { id: string; firstName: string; lastName: string; designation: string; photoUpdatedAt: string | null; departmentId: string | null; managerId: string | null };

export interface TrainingSessionSummary extends SessionRef {
  courseId: string;
  capacity: number | null;
  course: CourseRef;
  enrolled: number;
  completed: number;
}

export interface TrainingRecord {
  id: string;
  courseId: string;
  sessionId: string | null;
  employeeId: string;
  status: EnrolmentStatus;
  completedAt: string | null;
  hours: number | null;
  score: number | null;
  certificateExpiresAt: string | null;
  feedbackRating: number | null;
  feedbackComment: string | null;
  course: CourseRef;
  session: SessionRef | null;
  certificate?: CertificateState;
  employee?: TraineeRef;
}

export interface TrainingSessionDetail extends SessionRef {
  courseId: string;
  capacity: number | null;
  course: TrainingCourse;
  seatsLeft: number | null;
  enrolments: (TrainingRecord & { employee: TraineeRef })[];
  waiting: (TrainingRequest & { employee: TraineeRef })[];
}

export interface TrainingOverview {
  canGiveFeedback: boolean;
  hoursThisYear: number;
  completedCount: number;
  upcoming: TrainingRecord[];
  history: TrainingRecord[];
  certificates: TrainingRecord[];
}

export interface TrainingRequest {
  id: string;
  employeeId: string;
  courseId: string | null;
  title: string;
  reason: string;
  status: TrainingRequestStatus;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  course?: CourseRef | null;
  employee?: TraineeRef;
  canDecide?: boolean;
}

export interface TrainingReport {
  year: number;
  totals: { hours: number; cost: number; people: number; trained: number };
  byDepartment: { department: string; people: number; hours: number; cost: number }[];
  people: { employee: TraineeRef; hours: number; courses: number; noShows: number; cost: number }[];
}

// --- Attendance machines and check-in places -------------------------------------

export type DeviceKind = "ADMS" | "API" | "IMPORT";

export interface AttendanceDevice {
  id: string;
  name: string;
  kind: DeviceKind;
  serialNumber: string | null;
  apiKeyHint: string | null;
  branchId: string | null;
  timezone: string | null;
  isActive: boolean;
  lastSeenAt: string | null;
  lastPunchAt: string | null;
  createdAt: string;
  punchesLast24h: number;
}

export interface UnmatchedId {
  machineUserId: string;
  punches: number;
  firstAt: string;
  lastAt: string;
}

export interface OfficeNetwork {
  id: string;
  name: string;
  cidr: string;
}

export interface OfficeLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export interface PunchResult {
  received: number;
  saved: number;
  matched: number;
  skipped: number;
  unknownIds: string[];
}
