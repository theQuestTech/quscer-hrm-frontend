"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Pencil } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { formatDate, fullName, humanize } from "@/lib/format";
import type { EmployeeProfile } from "@/lib/types";
import { Alert, Button, Card, PageHeader, Spinner, Tabs } from "@/components/ui";
import { EmployeeStatusBadge } from "@/components/status-badges";
import { EmployeeForm } from "@/components/employee-form";
import { RequirePermission } from "@/components/app-shell";
import { AccessSection, BankSection, ContactsSection, DocumentsSection, PaySection } from "./sections";

type Tab = "overview" | "contacts" | "documents" | "bank" | "pay" | "access";

export default function EmployeeProfilePage() {
  return (
    <RequirePermission permission="hrm.employee.read">
      <Profile />
    </RequirePermission>
  );
}

function Profile() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const { data: employee, error, loading, reload } = useApi<EmployeeProfile>(`/employees/${id}`);
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);

  if (loading && !employee) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  if (!employee) return null;

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "contacts", label: "Emergency contacts" },
    { id: "documents", label: "Documents" },
    { id: "bank", label: "Bank" },
    ...(can("hrm.payroll.read") ? [{ id: "pay" as Tab, label: "Salary & loans" }] : []),
    ...(can("hrm.settings.write") ? [{ id: "access" as Tab, label: "Login access" }] : []),
  ];

  return (
    <>
      <Link href="/employees" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="size-4" /> Employees
      </Link>
      <PageHeader
        title={fullName(employee)}
        description={`${employee.designation} · ${employee.employeeNumber}`}
        actions={<EmployeeStatusBadge status={employee.status} />}
      />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === "overview" &&
        (editing ? (
          <Card title="Edit employee">
            <EmployeeForm
              employee={employee}
              submitLabel="Save changes"
              onCancel={() => setEditing(false)}
              onSubmit={async (values) => {
                await api("PATCH", `/employees/${employee.id}`, values);
                setEditing(false);
                reload();
              }}
            />
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <Card
              title="Details"
              className="lg:col-span-2"
              actions={
                can("hrm.employee.write") && (
                  <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                    <Pencil className="size-4" /> Edit
                  </Button>
                )
              }
            >
              <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                <Detail label="Email" value={employee.email} />
                <Detail label="Phone" value={employee.phone} />
                <Detail label="Employment type" value={humanize(employee.employmentType)} />
                <Detail label="Joined" value={formatDate(employee.dateOfJoining)} />
                <Detail label="Probation ends" value={formatDate(employee.probationEndDate)} />
                <Detail label="Confirmed" value={formatDate(employee.confirmedAt)} />
                {employee.contractEndDate && <Detail label="Contract ends" value={formatDate(employee.contractEndDate)} />}
                <Detail label="Branch" value={employee.branch?.name} />
                <Detail label="Department" value={employee.department?.name} />
                <Detail label="Tax jurisdiction" value={[employee.countryCode, employee.regionCode].filter(Boolean).join(" / ") || "Not set — payroll will skip this employee"} />
              </dl>
            </Card>
            <Card title="Reporting line">
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-slate-500">Reports to</p>
                  {employee.manager ? (
                    <Link href={`/employees/${employee.manager.id}`} className="font-medium text-brand-700 hover:underline">
                      {fullName(employee.manager)}
                    </Link>
                  ) : (
                    <p className="font-medium">—</p>
                  )}
                </div>
                <div>
                  <p className="text-slate-500">Direct reports</p>
                  {employee.directReports.length === 0 ? (
                    <p className="font-medium">None</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {employee.directReports.map((r) => (
                        <li key={r.id}>
                          <Link href={`/employees/${r.id}`} className="font-medium text-brand-700 hover:underline">
                            {fullName(r)}
                          </Link>{" "}
                          <span className="text-slate-500">· {r.designation}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Card>
          </div>
        ))}
      {tab === "contacts" && <ContactsSection employee={employee} onChange={reload} />}
      {tab === "documents" && <DocumentsSection employee={employee} onChange={reload} />}
      {tab === "bank" && <BankSection employee={employee} onChange={reload} />}
      {tab === "pay" && <PaySection employee={employee} />}
      {tab === "access" && <AccessSection employee={employee} onChange={reload} />}
    </>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-900">{value || "—"}</dd>
    </div>
  );
}
