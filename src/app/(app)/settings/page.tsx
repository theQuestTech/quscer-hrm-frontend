"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { PK_REGIONS, WEEKDAYS, formatDate } from "@/lib/format";
import type { AppUser, Branch, CostCentre, Department, Holiday, LeaveType, OrgSettings, Role, Shift } from "@/lib/types";
import { Alert, Badge, Button, Card, Field, Input, Modal, PageHeader, Spinner, Table, Tabs, Td, Th } from "@/components/ui";
import { RequirePermission } from "@/components/app-shell";
import { CrudList } from "./crud-list";

type Tab = "company" | "branches" | "departments" | "cost-centres" | "shifts" | "holidays" | "leave-types" | "users";

const TABS: { id: Tab; label: string }[] = [
  { id: "company", label: "Company" },
  { id: "branches", label: "Branches" },
  { id: "departments", label: "Departments" },
  { id: "cost-centres", label: "Cost centres" },
  { id: "shifts", label: "Shifts" },
  { id: "holidays", label: "Holidays" },
  { id: "leave-types", label: "Leave types" },
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
  const locale = settings.localeSettings;
  const [form, setForm] = useState({
    name: settings.name,
    defaultCurrency: locale?.defaultCurrency ?? "PKR",
    defaultTimezone: locale?.defaultTimezone ?? "Asia/Karachi",
    weekendDays: locale?.weekendDays ?? [0, 6],
  });
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api("PATCH", "/settings", form);
      setMessage({ tone: "success", text: "Saved" });
      onSaved();
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
      description="Working hours templates. Assigning shifts to employees and late/overtime calculation come later."
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
      description="Days per year is what each employee gets by default. Leave of an unpaid type is deducted from pay."
      fields={[
        { key: "name", label: "Name", required: true, placeholder: "Annual" },
        { key: "defaultAnnualDays", label: "Days per year", type: "number", required: true, defaultValue: "0" },
        { key: "isPaid", label: "Paid leave", type: "checkbox", defaultValue: true },
      ]}
      columns={[
        { label: "Name", render: (t) => <span className="font-medium text-slate-900">{t.name}</span> },
        { label: "Days per year", render: (t) => (t.isPaid ? t.defaultAnnualDays : "—") },
        { label: "Pay", render: (t) => (t.isPaid ? <Badge tone="green">Paid</Badge> : <Badge tone="yellow">Unpaid</Badge>) },
      ]}
    />
  );
}

function Users() {
  const { me } = useAuth();
  const users = useApi<AppUser[]>("/users");
  const roles = useApi<Role[]>("/roles");
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  async function toggleActive(user: AppUser) {
    if (user.isActive && !window.confirm(`Turn off ${user.firstName}'s access? They won't be able to sign in.`)) return;
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
      <Card title="People who can sign in" padded={false}>
        <p className="border-b border-slate-100 px-5 py-2 text-xs text-slate-500">
          To give an employee a login, open their profile → Login access.
        </p>
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
