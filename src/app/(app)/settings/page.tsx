"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { PK_REGIONS, WEEKDAYS, formatDate } from "@/lib/format";
import type { AppUser, Branch, CostCentre, Department, Holiday, LeaveType, OrgSettings, Role, Shift } from "@/lib/types";
import { Alert, Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Spinner, Table, Tabs, Td, Th } from "@/components/ui";
import { RequirePermission } from "@/components/app-shell";
import { CrudList } from "./crud-list";
import { AttendanceSettings } from "./attendance-settings";

type Tab = "company" | "branches" | "departments" | "cost-centres" | "shifts" | "holidays" | "leave-types" | "attendance" | "users";

const TABS: { id: Tab; label: string }[] = [
  { id: "company", label: "Company" },
  { id: "branches", label: "Branches" },
  { id: "departments", label: "Departments" },
  { id: "cost-centres", label: "Cost centres" },
  { id: "shifts", label: "Shifts" },
  { id: "holidays", label: "Holidays" },
  { id: "leave-types", label: "Leave types" },
  { id: "attendance", label: "Attendance & machines" },
  { id: "users", label: "Users & roles" },
];

export default function SettingsPage() {
  return (
    <RequirePermission permission="hrm.settings.write">
      <Suspense>
        <Settings />
      </Suspense>
    </RequirePermission>
  );
}

function Settings() {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>("company");
  const welcome = params.get("welcome") === "1";

  return (
    <>
      <PageHeader title="Settings" />
      {welcome && (
        <div className="mb-6">
          <Alert tone="info">
            <p className="font-medium">Welcome! Three quick steps to get going:</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5">
              <li>Check your company details and weekend days below.</li>
              <li>Add at least one branch — it sets the province used for tax and social security.</li>
              <li>Add your employees under Employees, then set their salaries.</li>
            </ol>
          </Alert>
        </div>
      )}
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === "company" && <CompanySettings />}
      {tab === "branches" && <Branches />}
      {tab === "departments" && <Departments />}
      {tab === "cost-centres" && <CostCentres />}
      {tab === "shifts" && <Shifts />}
      {tab === "holidays" && <Holidays />}
      {tab === "leave-types" && <LeaveTypes />}
      {tab === "attendance" && <AttendanceSettings />}
      {tab === "users" && <Users />}
    </>
  );
}

function CompanySettings() {
  const { refresh } = useAuth();
  const settings = useApi<OrgSettings>("/settings");
  if (settings.loading && !settings.data) return <Spinner />;
  if (settings.error) return <Alert>{settings.error}</Alert>;
  if (!settings.data) return null;
  return (
    <CompanyForm
      settings={settings.data}
      onSaved={() => {
        settings.reload();
        refresh();
      }}
    />
  );
}

function CompanyForm({ settings, onSaved }: { settings: OrgSettings; onSaved: () => void }) {
  const { refresh } = useAuth();
  const locale = settings.localeSettings;
  const [form, setForm] = useState({
    name: settings.name,
    defaultCurrency: locale?.defaultCurrency ?? "PKR",
    defaultTimezone: locale?.defaultTimezone ?? "Asia/Karachi",
    weekendDays: locale?.weekendDays ?? [0, 6],
    leaveApprovalSteps: locale?.leaveApprovalSteps ?? 1,
    lateGraceMinutes: locale?.lateGraceMinutes ?? 15,
    birthdayPostsEnabled: locale?.birthdayPostsEnabled ?? true,
    enabledModules: locale?.enabledModules ?? ["performance", "training", "recruitment"],
    kpiScoring: locale?.kpiScoring ?? "BOTH",
    selfReviewEnabled: locale?.selfReviewEnabled ?? true,
    careersSlug: settings.careersSlug ?? "",
    emailNotificationsEnabled: locale?.emailNotificationsEnabled ?? true,
  });
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const { careersSlug, ...rest } = form;
      // The address is picked from the company name the first time it's needed.
      await api("PATCH", "/settings", careersSlug.trim() ? { ...rest, careersSlug: careersSlug.trim() } : rest);
      setMessage({ tone: "success", text: "Saved" });
      onSaved();
      await refresh(); // module switches change the menu
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Could not save" });
    } finally {
      setSaving(false);
    }
  }

  const toggleDay = (day: number) =>
    setForm((f) => ({
      ...f,
      weekendDays: f.weekendDays.includes(day) ? f.weekendDays.filter((d) => d !== day) : [...f.weekendDays, day].sort(),
    }));

  return (
    <Card title="Company">
      <form onSubmit={save} className="max-w-2xl space-y-5">
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        <Field label="Company name">
          <Input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Currency" hint="3-letter code, e.g. PKR">
            <Input required maxLength={3} value={form.defaultCurrency} onChange={(e) => setForm({ ...form, defaultCurrency: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Timezone" hint="e.g. Asia/Karachi">
            <Input required value={form.defaultTimezone} onChange={(e) => setForm({ ...form, defaultTimezone: e.target.value })} />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">Weekend days</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day, i) => (
              <label
                key={day}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm ring-1 ring-inset ${
                  form.weekendDays.includes(i) ? "bg-brand-50 text-brand-700 ring-brand-600" : "text-slate-600 ring-slate-300"
                }`}
              >
                <input type="checkbox" className="sr-only" checked={form.weekendDays.includes(i)} onChange={() => toggleDay(i)} />
                {day}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">Weekend days aren&apos;t counted as leave days.</p>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Leave approval" hint="Two steps: a second, different person must also approve">
            <Select
              value={String(form.leaveApprovalSteps)}
              onChange={(e) => setForm({ ...form, leaveApprovalSteps: Number(e.target.value) })}
            >
              <option value="1">One person approves</option>
              <option value="2">Two people approve</option>
            </Select>
          </Field>
          <Field label="Late after (minutes)" hint="Grace time after the shift starts before a check-in counts as late">
            <Input
              type="number"
              min={0}
              max={240}
              required
              value={String(form.lateGraceMinutes)}
              onChange={(e) => setForm({ ...form, lateGraceMinutes: Number(e.target.value) })}
            />
          </Field>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={form.birthdayPostsEnabled}
            onChange={(e) => setForm({ ...form, birthdayPostsEnabled: e.target.checked })}
          />
          <span>
            Post birthday wishes on the feed
            <span className="block text-xs text-slate-500">Uses each employee&apos;s date of birth. Only the day is shown, never the age.</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={form.emailNotificationsEnabled}
            onChange={(e) => setForm({ ...form, emailNotificationsEnabled: e.target.checked })}
          />
          <span>
            Send email notifications
            <span className="block text-xs text-slate-500">
              Leave requests and decisions, payslips ready, training bookings, new job applications, welcome emails, and reminders for documents
              and certificates expiring within 30 days.
            </span>
          </span>
        </label>
        <fieldset className="space-y-2 border-t border-gray-100 pt-5">
          <legend className="mb-1 text-sm font-semibold text-[#1a1a2e]">Modules</legend>
          <p className="text-xs text-gray-500">Turn off what your company doesn&apos;t use; it disappears from the menu.</p>
          {[
            ["performance", "Performance & KPIs"],
            ["training", "Training"],
            ["recruitment", "Recruitment"],
          ].map(([id, label]) => (
            <label key={id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.enabledModules.includes(id)}
                onChange={(e) =>
                  setForm({
                    ...form,
                    enabledModules: e.target.checked ? [...form.enabledModules, id] : form.enabledModules.filter((m) => m !== id),
                  })
                }
              />
              {label}
            </label>
          ))}
        </fieldset>
        {form.enabledModules.includes("performance") && (
          <div className="grid gap-4 border-t border-gray-100 pt-5 sm:grid-cols-2">
            <Field label="How KPIs are scored" hint="Ratings: 1–5 stars. Targets: actual vs a number target.">
              <Select value={form.kpiScoring} onChange={(e) => setForm({ ...form, kpiScoring: e.target.value as typeof form.kpiScoring })}>
                <option value="BOTH">Both ratings and targets</option>
                <option value="RATING">1–5 ratings only</option>
                <option value="TARGET">Number targets only</option>
              </Select>
            </Field>
            <label className="flex items-start gap-2 self-center text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.selfReviewEnabled}
                onChange={(e) => setForm({ ...form, selfReviewEnabled: e.target.checked })}
              />
              <span>
                Employees review themselves first
                <span className="block text-xs text-gray-500">Turn off to go straight from goals to the manager&apos;s review.</span>
              </span>
            </label>
          </div>
        )}
        {form.enabledModules.includes("recruitment") && (
          <div className="border-t border-gray-100 pt-5">
            <Field
              label="Careers page address"
              hint={`Your public jobs page: ${typeof window !== "undefined" ? window.location.origin : ""}/careers/${form.careersSlug || "…"}. Lowercase letters, numbers and dashes.`}
            >
              <Input
                value={form.careersSlug}
                placeholder="Picked from your company name"
                pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]"
                onChange={(e) => setForm({ ...form, careersSlug: e.target.value.toLowerCase() })}
              />
            </Field>
          </div>
        )}
        <Button type="submit" loading={saving}>
          Save changes
        </Button>
      </form>
    </Card>
  );
}

function Branches() {
  return (
    <CrudList<Branch & Record<string, unknown>>
      title="Branches"
      itemName="branch"
      path="/branches"
      description="Each branch's province decides which social security scheme and minimum wage apply to the people in it."
      fields={[
        { key: "name", label: "Name", required: true, placeholder: "Lahore Head Office" },
        { key: "countryCode", label: "Country code", required: true, defaultValue: "PK", hint: "2 letters, e.g. PK" },
        { key: "regionCode", label: "Province", type: "select", options: PK_REGIONS.map((r) => ({ value: r.code, label: r.name })) },
        { key: "timezone", label: "Timezone", required: true, defaultValue: "Asia/Karachi" },
        { key: "isActive", label: "Active", type: "checkbox", defaultValue: true },
      ]}
      columns={[
        { label: "Name", render: (b) => <span className="font-medium text-slate-900">{b.name}</span> },
        { label: "Province", render: (b) => PK_REGIONS.find((r) => r.code === b.regionCode)?.name ?? b.regionCode ?? "—" },
        { label: "Employees", render: (b) => b._count?.employees ?? 0 },
        { label: "Status", render: (b) => (b.isActive ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>) },
      ]}
    />
  );
}

function Departments() {
  const branches = useApi<Branch[]>("/branches");
  const departments = useApi<Department[]>("/departments");
  const branchOptions = (branches.data ?? []).map((b) => ({ value: b.id, label: b.name }));
  const deptOptions = (departments.data ?? []).map((d) => ({ value: d.id, label: d.name }));
  return (
    <CrudList<Department & Record<string, unknown>>
      title="Departments"
      itemName="department"
      path="/departments"
      fields={[
        { key: "name", label: "Name", required: true, placeholder: "Engineering" },
        { key: "branchId", label: "Branch (optional)", type: "select", options: branchOptions },
        { key: "parentId", label: "Part of (optional)", type: "select", options: deptOptions, hint: "For sub-departments" },
      ]}
      columns={[
        { label: "Name", render: (d) => <span className="font-medium text-slate-900">{d.name}</span> },
        { label: "Branch", render: (d) => d.branch?.name ?? "All branches" },
        { label: "Part of", render: (d) => departments.data?.find((p) => p.id === d.parentId)?.name ?? "—" },
        { label: "Employees", render: (d) => d._count?.employees ?? 0 },
      ]}
    />
  );
}

function CostCentres() {
  const branches = useApi<Branch[]>("/branches");
  return (
    <CrudList<CostCentre & Record<string, unknown>>
      title="Cost centres"
      itemName="cost centre"
      path="/cost-centres"
      description="Used for reporting now, and for posting payroll to accounts once HRM is connected to Quscer OS."
      fields={[
        { key: "code", label: "Code", required: true, placeholder: "CC-01" },
        { key: "name", label: "Name", required: true },
        { key: "branchId", label: "Branch (optional)", type: "select", options: (branches.data ?? []).map((b) => ({ value: b.id, label: b.name })) },
      ]}
      columns={[
        { label: "Code", render: (c) => <span className="font-mono">{c.code}</span> },
        { label: "Name", render: (c) => <span className="font-medium text-slate-900">{c.name}</span> },
        { label: "Branch", render: (c) => c.branch?.name ?? "—" },
      ]}
    />
  );
}

function Shifts() {
  return (
    <CrudList<Shift & Record<string, unknown>>
      title="Shifts"
      itemName="shift"
      path="/shifts"
      description="Working hours. Pick a shift on each employee's profile to track late arrival, early leaving and overtime. A shift that ends before it starts (e.g. 22:00–06:00) runs overnight."
      fields={[
        { key: "name", label: "Name", required: true, placeholder: "General shift" },
        { key: "startTime", label: "Starts", type: "time", required: true, defaultValue: "09:00" },
        { key: "endTime", label: "Ends", type: "time", required: true, defaultValue: "18:00" },
      ]}
      columns={[
        { label: "Name", render: (s) => <span className="font-medium text-slate-900">{s.name}</span> },
        { label: "Hours", render: (s) => `${s.startTime} – ${s.endTime}` },
      ]}
    />
  );
}

function Holidays() {
  const branches = useApi<Branch[]>("/branches");
  return (
    <CrudList<Holiday & Record<string, unknown>>
      title="Holidays"
      itemName="holiday"
      path="/holidays"
      canEdit={false}
      description="Holidays aren't counted as leave days. Leave the branch empty for company-wide holidays."
      fields={[
        { key: "name", label: "Name", required: true, placeholder: "Independence Day" },
        { key: "date", label: "Date", type: "date", required: true },
        { key: "branchId", label: "Only for branch (optional)", type: "select", options: (branches.data ?? []).map((b) => ({ value: b.id, label: b.name })) },
      ]}
      columns={[
        { label: "Date", render: (h) => formatDate(h.date) },
        { label: "Name", render: (h) => <span className="font-medium text-slate-900">{h.name}</span> },
        { label: "Applies to", render: (h) => branches.data?.find((b) => b.id === h.branchId)?.name ?? "Whole company" },
      ]}
    />
  );
}

function LeaveTypes() {
  return (
    <CrudList<LeaveType & Record<string, unknown>>
      title="Leave types"
      itemName="leave type"
      path="/leave-types"
      canDelete={false}
      description="Leave of an unpaid type is deducted from pay. Paid leave can't go over what's left unless you allow it."
      fields={[
        { key: "name", label: "Name", required: true, placeholder: "Annual" },
        { key: "defaultAnnualDays", label: "Days per year", type: "number", required: true, defaultValue: "0" },
        { key: "isPaid", label: "Paid leave", type: "checkbox", defaultValue: true },
        {
          key: "accrual",
          label: "How days are given",
          type: "select",
          required: true,
          defaultValue: "ANNUAL",
          hint: "People who join mid-year get a share either way.",
          options: [
            { value: "ANNUAL", label: "All at the start of the year" },
            { value: "MONTHLY", label: "A little each month" },
          ],
        },
        {
          key: "maxCarryForwardDays",
          label: "Carry over to next year (max days)",
          type: "number",
          defaultValue: "0",
          hint: "0 = unused days are lost at year end",
        },
        { key: "isEncashable", label: "Pay out unused days when someone leaves", type: "checkbox", defaultValue: false },
        { key: "allowNegativeBalance", label: "Allow taking more than what's left", type: "checkbox", defaultValue: false },
      ]}
      columns={[
        { label: "Name", render: (t) => <span className="font-medium text-slate-900">{t.name}</span> },
        { label: "Days per year", render: (t) => (t.isPaid ? t.defaultAnnualDays : "—") },
        { label: "Pay", render: (t) => (t.isPaid ? <Badge tone="green">Paid</Badge> : <Badge tone="yellow">Unpaid</Badge>) },
        { label: "Given", render: (t) => (t.isPaid ? (t.accrual === "MONTHLY" ? "Monthly" : "Yearly") : "—") },
        { label: "Carry over", render: (t) => (t.isPaid && t.maxCarryForwardDays ? `up to ${t.maxCarryForwardDays}` : "—") },
        {
          label: "Rules",
          render: (t) => (
            <div className="flex flex-wrap gap-1">
              {t.isEncashable && <Badge tone="blue">Paid out on exit</Badge>}
              {t.allowNegativeBalance && <Badge tone="yellow">Can go negative</Badge>}
            </div>
          ),
        },
      ]}
    />
  );
}

function Users() {
  const { me } = useAuth();
  const users = useApi<AppUser[]>("/users");
  const roles = useApi<Role[]>("/roles");
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [resetting, setResetting] = useState<AppUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetDone, setResetDone] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [addingPerson, setAddingPerson] = useState(false);
  const [person, setPerson] = useState({ email: "", firstName: "", lastName: "", password: "", roleIds: [] as string[] });

  // Someone without an employee record: outsourced HR, accountant… If the
  // email already has a login (e.g. from their own firm) they keep it.
  async function addPerson(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await api<{ existingLogin: boolean }>("POST", "/users", {
        ...person,
        password: person.password || undefined,
      });
      setResetDone(
        res.existingLogin
          ? `${person.firstName} already had a login, so they sign in with their own password and pick this company from the menu.`
          : `${person.firstName} can now sign in with ${person.email} and the password you set.`,
      );
      setAddingPerson(false);
      setPerson({ email: "", firstName: "", lastName: "", password: "", roleIds: [] });
      users.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add");
    } finally {
      setSaving(false);
    }
  }

  function open(user: AppUser) {
    setSelected(user.roles.map((r) => r.id));
    setError(null);
    setEditing(user);
  }

  async function saveRoles() {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      await api("PUT", `/users/${editing.id}/roles`, { roleIds: selected });
      setEditing(null);
      users.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetting) return;
    setSaving(true);
    setError(null);
    try {
      await api("POST", `/users/${resetting.id}/reset-password`, { newPassword });
      setResetDone(`${resetting.firstName}'s password was reset. Share the new password with them.`);
      setResetting(null);
      setNewPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: AppUser) {
    if (
      user.isActive &&
      !window.confirm(
        user.hasOtherCompanies
          ? `Turn off ${user.firstName}'s access to this company? Their other companies aren't affected.`
          : `Turn off ${user.firstName}'s access? They won't be able to sign in.`,
      )
    )
      return;
    setListError(null);
    try {
      await api("PATCH", `/users/${user.id}`, { isActive: !user.isActive });
      users.reload();
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Could not update");
    }
  }

  return (
    <div className="space-y-6">
      <Card
        title="People who can sign in"
        padded={false}
        actions={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setError(null);
              setAddingPerson(true);
            }}
          >
            Add person
          </Button>
        }
      >
        <p className="border-b border-slate-100 px-5 py-2 text-xs text-slate-500">
          To give an employee a login, open their profile → Login access. Use &ldquo;Add person&rdquo; for people who aren&apos;t
          employees here, like an outsourced HR company or your accountant.
        </p>
        {resetDone && (
          <div className="p-4">
            <Alert tone="success">{resetDone}</Alert>
          </div>
        )}
        {(listError || users.error) && (
          <div className="p-4">
            <Alert>{listError ?? users.error}</Alert>
          </div>
        )}
        {users.loading && !users.data ? (
          <Spinner />
        ) : (
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <Th>Name</Th>
                <Th>Roles</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.data?.map((u) => {
                const isMe = u.id === me?.user.id;
                return (
                  <tr key={u.id}>
                    <Td>
                      <p className="font-medium text-slate-900">
                        {u.firstName} {u.lastName} {isMe && <span className="text-xs text-slate-500">(you)</span>}
                      </p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                      {u.hasOtherCompanies && <p className="text-xs text-slate-500">Also works for other companies</p>}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length ? u.roles.map((r) => <Badge key={r.id} tone="blue">{r.name}</Badge>) : <span className="text-slate-400">None</span>}
                      </div>
                    </Td>
                    <Td>{u.isActive ? <Badge tone="green">Active</Badge> : <Badge>Turned off</Badge>}</Td>
                    <Td className="text-right">
                      {!isMe && (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="secondary" onClick={() => open(u)}>
                            Roles
                          </Button>
                          {!u.hasOtherCompanies && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setError(null);
                                setResetDone(null);
                                setNewPassword("");
                                setResetting(u);
                              }}
                            >
                              Reset password
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => toggleActive(u)}>
                            {u.isActive ? "Turn off" : "Turn on"}
                          </Button>
                        </div>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Card title="What each role can do">
        <div className="grid gap-4 sm:grid-cols-2">
          {roles.data?.map((r) => (
            <div key={r.id} className="rounded-lg bg-slate-50 p-4">
              <p className="font-medium text-slate-900">{r.name}</p>
              <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
                {r.permissions.map((p) => (
                  <li key={p.permission.key}>{p.permission.description ?? p.permission.key}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <Modal open={resetting !== null} onClose={() => setResetting(null)} title={`Reset password for ${resetting?.firstName ?? ""}`}>
        <form onSubmit={resetPassword} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <p className="text-sm text-slate-600">
            Set a temporary password and share it with {resetting?.firstName}. They can change it afterwards from &ldquo;Change
            password&rdquo; in the menu.
          </p>
          <Field label="New password" hint="At least 8 characters">
            <Input type="text" autoComplete="off" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              Reset password
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={addingPerson} onClose={() => setAddingPerson(false)} title="Add a person">
        <form onSubmit={addPerson} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <Field label="Email">
            <Input type="email" required value={person.email} onChange={(e) => setPerson({ ...person, email: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="First name">
              <Input required value={person.firstName} onChange={(e) => setPerson({ ...person, firstName: e.target.value })} />
            </Field>
            <Field label="Last name">
              <Input required value={person.lastName} onChange={(e) => setPerson({ ...person, lastName: e.target.value })} />
            </Field>
          </div>
          <Field label="Starting password" hint="Only needed if this email doesn't have a login yet. At least 8 characters.">
            <Input
              type="text"
              autoComplete="off"
              minLength={8}
              value={person.password}
              onChange={(e) => setPerson({ ...person, password: e.target.value })}
            />
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-700">Roles</legend>
            {roles.data?.map((r) => (
              <label key={r.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={person.roleIds.includes(r.id)}
                  onChange={(e) =>
                    setPerson((p) => ({
                      ...p,
                      roleIds: e.target.checked ? [...p.roleIds, r.id] : p.roleIds.filter((x) => x !== r.id),
                    }))
                  }
                />
                {r.name}
              </label>
            ))}
          </fieldset>
          <div className="flex justify-end">
            <Button type="submit" loading={saving} disabled={person.roleIds.length === 0}>
              Add person
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={`Roles for ${editing?.firstName ?? ""}`}>
        <div className="space-y-4">
          {error && <Alert>{error}</Alert>}
          {roles.data?.map((r) => (
            <label key={r.id} className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={selected.includes(r.id)}
                onChange={(e) => setSelected((s) => (e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id)))}
              />
              <span>
                <span className="font-medium">{r.name}</span>
                <span className="block text-xs text-slate-500">{r.permissions.length} permissions</span>
              </span>
            </label>
          ))}
          <div className="flex justify-end">
            <Button onClick={saveRoles} loading={saving}>
              Save roles
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
