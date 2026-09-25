"use client";

// The dashboard, laid out like the Figma Make design, in four versions:
//   Employee   — their own attendance, leave, payslip and company news
//   Manager    — the same, plus their team today and approvals waiting
//   HR         — the whole company (the design as drawn)
//   Outsourced — HR who work for more than one company also get
//                "All my companies", one card per company
// Only features the app has are shown; photos are initials.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { formatMoney, formatMonth, humanize } from "@/lib/format";
import type {
  CompanyCard,
  DashboardSummary,
  LeaveBalance,
  LeaveRequest,
  Me,
  MyPayslip,
  MySummary,
  TeamSummary,
} from "@/lib/types";
import { Alert, Spinner, Tabs } from "@/components/ui";
import { roleLabel } from "@/components/app-shell";
import { Icon } from "@/components/figma-icons";
import {
  AttendanceCalendar,
  AttendanceOverview,
  CompanyNews,
  GreetingBanner,
  LeaveList,
  Panel,
  PeopleToday,
  ProfilePanel,
  QUICK_TONES,
  QuickStats,
  RecentActivity,
  STAT_TONES,
  StatCards,
  highlightOrder,
  myLeaveItems,
  useMyMonth,
  ym,
} from "@/components/dashboard/widgets";

type Kind = "hr" | "manager" | "employee";

export default function DashboardPage() {
  const { me, can } = useAuth();
  const [view, setView] = useState<"company" | "all">("company");
  if (!me) return null;

  const kind: Kind =
    can("hrm.employee.write") || can("hrm.settings.write")
      ? "hr"
      : can("hrm.leave.approve") || can("hrm.attendance.approve")
        ? "manager"
        : "employee";
  const outsourced = kind === "hr" && me.companies.length > 1;

  return (
    // Room on the right for the profile panel (not shown on "All my companies").
    <div className={`space-y-4 ${outsourced && view === "all" ? "" : "xl:pr-[240px]"}`}>
      <GreetingBanner
        firstName={me.user.firstName}
        subtitle={
          kind === "hr"
            ? `Here's what's happening at ${me.organization.name} today.`
            : kind === "manager"
              ? "Here's what's happening with you and your team today."
              : "Here's what's happening with your work today."
        }
      />
      {outsourced && (
        <Tabs
          tabs={[
            { id: "company", label: me.organization.name },
            { id: "all", label: `All my companies (${me.companies.length})` },
          ]}
          value={view}
          onChange={setView}
        />
      )}
      {outsourced && view === "all" ? (
        <AllCompanies onOpened={() => setView("company")} />
      ) : kind === "hr" ? (
        <HrDashboard me={me} can={can} />
      ) : kind === "manager" ? (
        <ManagerDashboard me={me} />
      ) : (
        <EmployeeDashboard me={me} />
      )}
    </div>
  );
}

// --- Personal numbers (used by employee + manager, and HR with a profile) ----

function usePersonal(me: Me) {
  const id = me.employee?.id ?? null;
  const my = useApi<MySummary>("/dashboard/me");
  const balances = useApi<LeaveBalance[]>(id ? "/leave-balances" : null);
  const requests = useApi<LeaveRequest[]>(id ? `/leave-requests?employeeId=${id}` : null);
  const payslips = useApi<MyPayslip[]>(id ? "/my-payslips" : null);
  const month = useMyMonth(ym(new Date()), id);
  const paid = (balances.data ?? []).filter((b) => b.leaveType.isPaid);
  const annual = paid.find((b) => b.leaveType.name.toLowerCase() === "annual") ?? paid[0];
  const latest = payslips.data?.[0] ?? null;
  return {
    my: my.data,
    month,
    requests: requests.data,
    paidLeft: paid.reduce((s, b) => s + b.remainingDays, 0),
    annual,
    usedThisYear: paid.reduce((s, b) => s + b.usedDays, 0),
    latest,
    pending: (my.data?.pendingRequests.leave ?? 0) + (my.data?.pendingRequests.corrections ?? 0),
  };
}

function personalQuickStats(p: ReturnType<typeof usePersonal>) {
  return [
    {
      label: p.annual ? `${p.annual.leaveType.name} Leave Balance` : "Leave Balance",
      value: `${p.annual?.remainingDays ?? 0} days`,
      ...QUICK_TONES.blue,
      href: "/leave",
    },
    { label: "Pending Leave Requests", value: p.my?.pendingRequests.leave ?? 0, ...QUICK_TONES.amber, href: "/leave" },
    {
      label: p.latest ? `Payroll (${formatMonth(p.latest.periodStart)})` : "Payroll (Latest)",
      value: p.latest ? formatMoney(p.latest.netSalary, p.latest.currency) : "No payslip yet",
      ...QUICK_TONES.green,
      href: "/payslips",
    },
    { label: "Leave Taken This Year", value: `${p.usedThisYear} days`, ...QUICK_TONES.purple, href: "/leave" },
  ];
}

const EMPLOYEE_LINKS = [
  { label: "My Profile", href: "/account" },
  { label: "Attendance", href: "/attendance" },
  { label: "Leave Balance", href: "/leave" },
  { label: "Payslips", href: "/payslips" },
  { label: "Feed", href: "/feed" },
];
const EMPLOYEE_ACTIONS = [
  { label: "Apply for Leave", href: "/leave?new=1" },
  { label: "Request Attendance Correction", href: "/attendance?fix=1" },
  { label: "View Payslip", href: "/payslips" },
];

// --- Employee -------------------------------------------------------------------

function EmployeeDashboard({ me }: { me: Me }) {
  const p = usePersonal(me);
  const emp = me.employee;
  if (!emp) {
    return (
      <>
        <Alert tone="info">
          Your login isn&apos;t linked to an employee profile in {me.organization.name}, so there&apos;s no attendance, leave or
          payslip to show. Ask HR to link it.
        </Alert>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <RecentActivity items={[]} />
          <CompanyNews />
        </div>
      </>
    );
  }
  const profile = { ...emp, designation: emp.designation, employeeNumber: emp.employeeNumber };
  return (
    <>
      <StatCards
        cards={[
          { label: "Days Present", value: p.month.counts.present, sub: "this month", ...STAT_TONES.teal, href: "/attendance" },
          {
            label: "Attendance Rate",
            value: p.month.counts.attendanceRate === null ? "—" : `${p.month.counts.attendanceRate}%`,
            sub: "of days marked this month",
            ...STAT_TONES.blue,
            href: "/attendance",
          },
          { label: "Leave Balance", value: p.paidLeft, sub: "paid leave days left", ...STAT_TONES.purple, href: "/leave" },
          { label: "Pending Requests", value: p.pending, sub: "Leaves / Requests", ...STAT_TONES.amber, href: "/leave" },
        ]}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.9fr)]">
        <AttendanceOverview title="Attendance Overview" counts={p.month.counts} rateLabel="This month" link={{ href: "/attendance", label: "View Details" }} />
        <LeaveList
          title="My Leave"
          items={myLeaveItems(p.requests, profile)}
          link={{ href: "/leave", label: "View All" }}
          empty="No upcoming leave. Use Apply for Leave to request some."
        />
        <QuickStats items={personalQuickStats(p)} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
        <AttendanceCalendar employeeId={emp.id} />
        <RecentActivity items={p.my?.activity ?? []} />
        <CompanyNews />
      </div>
      <ProfilePanel person={emp} subtitle={emp.designation} badge={emp.employeeNumber} links={EMPLOYEE_LINKS} actions={EMPLOYEE_ACTIONS} />
    </>
  );
}

// --- Manager --------------------------------------------------------------------

function pct(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function ManagerDashboard({ me }: { me: Me }) {
  const team = useApi<TeamSummary>("/dashboard/team");
  const p = usePersonal(me);
  const t = team.data;
  if (team.error) return <Alert>{team.error}</Alert>;
  if (!t) return <Spinner />;
  const emp = me.employee;
  return (
    <>
      <StatCards
        cards={[
          { label: "Team Members", value: t.counts.total, sub: "people reporting to you", ...STAT_TONES.teal },
          {
            label: "Present Today",
            value: t.counts.present,
            sub: t.counts.attendanceRate === null ? "day off today" : `${t.counts.attendanceRate}% attendance rate`,
            ...STAT_TONES.blue,
            href: "/attendance?tab=register",
          },
          { label: "On Leave", value: t.counts.onLeave, sub: `${pct(t.counts.onLeave, t.counts.total)}% of your team`, ...STAT_TONES.purple },
          {
            label: "Pending Approvals",
            value: t.pendingApprovals.leave + t.pendingApprovals.corrections,
            sub: "Leaves / Requests",
            ...STAT_TONES.amber,
            href: "/leave?tab=approvals",
          },
        ]}
      />
      {t.counts.total === 0 && (
        <Alert tone="info">Nobody reports to you yet. HR sets this with &ldquo;Reports to&rdquo; on each employee&apos;s profile.</Alert>
      )}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.9fr)]">
        <AttendanceOverview title="Team Attendance Today" counts={t.counts} link={{ href: "/attendance?tab=register", label: "View Details" }} />
        <LeaveList
          title="Team Upcoming Leave"
          items={t.upcomingLeave}
          link={{ href: "/leave?tab=approvals", label: "View All" }}
          empty="No one in your team has leave coming up."
        />
        {emp ? <QuickStats items={personalQuickStats(p)} /> : <CompanyNews />}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
        {emp ? <AttendanceCalendar employeeId={emp.id} /> : <CompanyNews />}
        <RecentActivity items={p.my?.activity ?? []} />
        <PeopleToday
          title="Team Highlights"
          people={highlightOrder(t.people)}
          link={{ href: "/attendance?tab=register", label: "View All" }}
          empty="No team members yet."
        />
      </div>
      <ProfilePanel
        person={emp ?? me.user}
        subtitle={emp?.designation ?? roleLabel(me.roles)}
        badge={emp?.employeeNumber}
        links={[{ label: "My Team", href: "/employees" }, ...EMPLOYEE_LINKS]}
        actions={[
          { label: "Approve Leave", href: "/leave?tab=approvals" },
          { label: "Time Corrections", href: "/attendance?tab=corrections" },
          ...(emp ? EMPLOYEE_ACTIONS : []),
        ]}
      />
    </>
  );
}

// --- HR ---------------------------------------------------------------------------

function HrDashboard({ me, can }: { me: Me; can: (p: string) => boolean }) {
  const summary = useApi<DashboardSummary>("/dashboard/summary");
  const s = summary.data;
  if (summary.error) return <Alert>{summary.error}</Alert>;
  if (!s) return <Spinner />;
  const emp = me.employee;
  const change = s.activeEmployeesMonthAgo > 0 ? pct(s.activeEmployees - s.activeEmployeesMonthAgo, s.activeEmployeesMonthAgo) : 0;
  const waiting = s.pendingApprovals.leave + s.pendingApprovals.corrections + s.pendingApprovals.settlements;
  const run = s.latestPayrollRun;

  return (
    <>
      <StatCards
        cards={[
          {
            label: "Total Employees",
            value: s.activeEmployees,
            sub: "vs. last month",
            badge: change !== 0 ? `${change > 0 ? "↑" : "↓"} ${Math.abs(change)}%` : null,
            badgeColor: change > 0 ? "#059669" : "#dc2626",
            ...STAT_TONES.teal,
            href: "/employees",
          },
          {
            label: "Present Today",
            value: s.attendance.present,
            sub: s.attendance.attendanceRate === null ? "day off today" : `${s.attendance.attendanceRate}% attendance rate`,
            ...STAT_TONES.blue,
            href: "/attendance?tab=register",
          },
          {
            label: "On Leave",
            value: s.attendance.onLeave,
            sub: `${pct(s.attendance.onLeave, s.activeEmployees)}% of total staff`,
            ...STAT_TONES.purple,
          },
          { label: "Pending Approvals", value: waiting, sub: "Leaves / Requests", ...STAT_TONES.amber, href: "/leave?tab=approvals" },
        ]}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.9fr)]">
        <AttendanceOverview title="Attendance Overview" counts={s.attendance} link={{ href: "/attendance?tab=register", label: "View Details" }} />
        <LeaveList
          title="Upcoming Leave"
          items={s.upcomingLeave}
          link={{ href: "/leave?tab=approvals", label: "View All" }}
          empty="No leave coming up in the next 30 days."
        />
        <QuickStats
          items={[
            {
              label: "Latest Payroll",
              value: run ? `${formatMonth(run.periodStart)} · ${humanize(run.status)}` : "Not run yet",
              ...QUICK_TONES.blue,
              href: run ? `/payroll/${run.id}` : "/payroll",
            },
            {
              label: "Time Corrections Waiting",
              value: s.pendingApprovals.corrections,
              ...QUICK_TONES.amber,
              href: "/attendance?tab=corrections",
            },
            {
              label: "Payroll Total (Net)",
              value: run ? formatMoney(run.totalNet, run.currency ?? me.organization.currency) : "—",
              ...QUICK_TONES.green,
              href: run ? `/payroll/${run.id}` : "/payroll",
            },
            { label: "Documents Expiring (30 days)", value: s.expiringDocuments.length, ...QUICK_TONES.purple },
          ]}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
        {emp ? <AttendanceCalendar employeeId={emp.id} /> : <ExpiringDocuments docs={s.expiringDocuments} />}
        <RecentActivity items={s.activity} />
        <PeopleToday
          title="Team Highlights"
          people={highlightOrder(s.people)}
          link={{ href: "/attendance?tab=register", label: "View All" }}
          empty="Add employees to see who's in today."
        />
      </div>
      <ProfilePanel
        person={emp ?? me.user}
        subtitle={emp?.designation ?? roleLabel(me.roles)}
        badge={emp?.employeeNumber}
        links={[
          { label: "Employees", href: "/employees", show: can("hrm.employee.read") },
          { label: "Attendance", href: "/attendance", show: can("hrm.attendance.read") },
          { label: "Leave", href: "/leave", show: can("hrm.leave.read") },
          { label: "Payroll", href: "/payroll", show: can("hrm.payroll.read") },
          { label: "Feed", href: "/feed", show: true },
          { label: "Settings", href: "/settings", show: can("hrm.settings.write") },
        ].filter((l) => l.show)}
        actions={[
          { label: "Add Employee", href: "/employees/new", show: can("hrm.employee.write") },
          { label: "Approve Leave", href: "/leave?tab=approvals", show: can("hrm.leave.approve") },
          { label: "Time Corrections", href: "/attendance?tab=corrections", show: can("hrm.attendance.approve") },
          { label: "Run Payroll", href: "/payroll", show: can("hrm.payroll.run") },
        ].filter((a) => a.show)}
      />
    </>
  );
}

function ExpiringDocuments({ docs }: { docs: DashboardSummary["expiringDocuments"] }) {
  return (
    <Panel title="Documents Expiring Soon">
      {docs.length === 0 ? (
        <p className="py-6 text-center text-xs text-gray-400">Nothing expires in the next 30 days.</p>
      ) : (
        <div className="space-y-3">
          {docs.slice(0, 6).map((d) => (
            <a key={d.id} href={`/employees/${d.employee.id}`} className="flex items-center justify-between gap-3 rounded-lg hover:bg-[#f9fafb]">
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-[#1a1a2e]">
                  {d.employee.firstName} {d.employee.lastName}
                </div>
                <div className="text-[10px] text-gray-500">{d.category}</div>
              </div>
              <span className="text-[10px] font-semibold text-amber-700">
                {new Date(d.expiryDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}
              </span>
            </a>
          ))}
        </div>
      )}
    </Panel>
  );
}

// --- Outsourced HR: every company at a glance --------------------------------------

function AllCompanies({ onOpened }: { onOpened: () => void }) {
  const { me, switchCompany } = useAuth();
  const router = useRouter();
  const cards = useApi<CompanyCard[]>("/dashboard/companies");
  const [opening, setOpening] = useState<string | null>(null);
  if (cards.error) return <Alert>{cards.error}</Alert>;
  if (!cards.data) return <Spinner />;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {cards.data.map((c) => {
        const here = c.id === me?.organization.id;
        return (
          <section key={c.id} className="rounded-2xl border border-gray-100 bg-white p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8faf8]">
                <Icon name="briefcase" size={20} color="#00b4a6" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold text-[#1a1a2e]" style={{ fontFamily: "var(--font-display)" }}>
                  {c.name}
                </h2>
                <p className="text-[11px] text-gray-500">
                  {c.latestPayrollRun
                    ? `Payroll ${formatMonth(c.latestPayrollRun.periodStart)} · ${humanize(c.latestPayrollRun.status)}`
                    : "No payroll run yet"}
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-4 gap-2 text-center">
              {[
                ["Employees", c.activeEmployees],
                ["Present", c.presentToday],
                ["On leave", c.onLeaveToday],
                ["Waiting", c.pendingApprovals],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-[#f9fafb] px-1 py-2">
                  <dd className="text-lg font-bold text-[#1a1a2e]" style={{ fontFamily: "var(--font-display)" }}>
                    {value}
                  </dd>
                  <dt className="text-[10px] text-gray-500">{label}</dt>
                </div>
              ))}
            </dl>
            <button
              type="button"
              disabled={here || opening !== null}
              onClick={async () => {
                setOpening(c.id);
                try {
                  await switchCompany(c.id);
                  onOpened();
                  router.push("/");
                } finally {
                  setOpening(null);
                }
              }}
              className="mt-4 w-full rounded-xl bg-[#00857a] py-2 text-sm font-medium text-white transition-colors hover:bg-[#006e65] disabled:bg-[#e8faf8] disabled:text-[#00857a]"
            >
              {here ? "You're here" : opening === c.id ? "Opening…" : `Open ${c.name}`}
            </button>
          </section>
        );
      })}
    </div>
  );
}
