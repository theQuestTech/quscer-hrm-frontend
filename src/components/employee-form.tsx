"use client";

import { useState } from "react";
import { useApi } from "@/lib/use-api";
import { PK_REGIONS, humanize, todayInput, toDateInput } from "@/lib/format";
import type { Branch, Department, Employee, EmploymentType, Paginated, Shift } from "@/lib/types";
import { Alert, Button, Field, Input, Select } from "./ui";

const EMPLOYMENT_TYPES: EmploymentType[] = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"];

export type EmployeeFormValues = Record<string, string>;

function initialValues(e?: Employee): EmployeeFormValues {
  return {
    employeeNumber: e?.employeeNumber ?? "",
    firstName: e?.firstName ?? "",
    lastName: e?.lastName ?? "",
    email: e?.email ?? "",
    phone: e?.phone ?? "",
    designation: e?.designation ?? "",
    employmentType: e?.employmentType ?? "FULL_TIME",
    dateOfJoining: toDateInput(e?.dateOfJoining),
    dateOfBirth: toDateInput(e?.dateOfBirth),
    probationEndDate: toDateInput(e?.probationEndDate),
    contractEndDate: toDateInput(e?.contractEndDate),
    branchId: e?.branchId ?? "",
    departmentId: e?.departmentId ?? "",
    managerId: e?.managerId ?? "",
    shiftId: e?.shiftId ?? "",
    regionCode: e?.regionCode ?? "",
    status: e?.status ?? "ACTIVE",
  };
}

// Shared by "Add employee" and the profile's edit form. Empty optional
// fields are sent as undefined (create) so the backend keeps its defaults,
// e.g. inheriting country/region from the branch.
export function EmployeeForm({
  employee,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  employee?: Employee;
  submitLabel: string;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState(() => initialValues(employee));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const branches = useApi<Branch[]>("/branches");
  const departments = useApi<Department[]>("/departments");
  const shifts = useApi<Shift[]>("/shifts");
  const managers = useApi<Paginated<Employee>>("/employees?pageSize=100&status=ACTIVE");

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values)) {
      if (key === "status" && !employee) continue; // new employees start ACTIVE
      if (value === "") {
        // On edit, clearing an optional date or the shift removes it; other blanks are left alone.
        if (employee && (key === "probationEndDate" || key === "contractEndDate" || key === "dateOfBirth" || key === "shiftId"))
          payload[key] = null;
        continue;
      }
      payload[key] = value;
    }
    try {
      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  const visibleDepartments = (departments.data ?? []).filter(
    (d) => !values.branchId || !d.branchId || d.branchId === values.branchId,
  );

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Employee number">
          <Input required value={values.employeeNumber} onChange={set("employeeNumber")} placeholder="EMP-001" />
        </Field>
        <Field label="First name">
          <Input required value={values.firstName} onChange={set("firstName")} />
        </Field>
        <Field label="Last name">
          <Input required value={values.lastName} onChange={set("lastName")} />
        </Field>
        <Field label="Work email">
          <Input type="email" required value={values.email} onChange={set("email")} />
        </Field>
        <Field label="Phone">
          <Input value={values.phone} onChange={set("phone")} />
        </Field>
        <Field label="Job title">
          <Input required value={values.designation} onChange={set("designation")} />
        </Field>
        <Field label="Employment type">
          <Select value={values.employmentType} onChange={set("employmentType")}>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {humanize(t)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Joining date">
          <Input type="date" required value={values.dateOfJoining} onChange={set("dateOfJoining")} />
        </Field>
        <Field label="Date of birth" hint="Optional — for birthday wishes on the feed">
          <Input type="date" max={todayInput()} value={values.dateOfBirth} onChange={set("dateOfBirth")} />
        </Field>
        <Field label="Probation ends">
          <Input type="date" value={values.probationEndDate} onChange={set("probationEndDate")} />
        </Field>
        {(values.employmentType === "CONTRACT" || values.employmentType === "INTERN") && (
          <Field label="Contract ends">
            <Input type="date" value={values.contractEndDate} onChange={set("contractEndDate")} />
          </Field>
        )}
        {employee && (
          <Field label="Status">
            <Select value={values.status} onChange={set("status")}>
              {["ACTIVE", "ON_LEAVE", "SUSPENDED", "TERMINATED"].map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      <div className="grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Branch" hint={branches.data?.length === 0 ? "Add branches in Settings first" : undefined}>
          <Select value={values.branchId} onChange={set("branchId")}>
            <option value="">—</option>
            {branches.data?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Department">
          <Select value={values.departmentId} onChange={set("departmentId")}>
            <option value="">—</option>
            {visibleDepartments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Shift" hint={shifts.data?.length === 0 ? "Add shifts in Settings to track late arrival and overtime" : undefined}>
          <Select value={values.shiftId} onChange={set("shiftId")}>
            <option value="">No shift</option>
            {shifts.data?.map((sh) => (
              <option key={sh.id} value={sh.id}>
                {sh.name} ({sh.startTime}–{sh.endTime})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reports to">
          <Select value={values.managerId} onChange={set("managerId")}>
            <option value="">—</option>
            {managers.data?.items
              .filter((m) => m.id !== employee?.id)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName} · {m.designation}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Province (for tax & social security)" hint="Leave blank to use the branch's province">
          <Select value={values.regionCode} onChange={set("regionCode")}>
            <option value="">From branch</option>
            {PK_REGIONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
