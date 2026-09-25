"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Employee } from "@/lib/types";
import { Card, PageHeader } from "@/components/ui";
import { EmployeeForm } from "@/components/employee-form";
import { RequirePermission } from "@/components/app-shell";

export default function NewEmployeePage() {
  const router = useRouter();
  return (
    <RequirePermission permission="hrm.employee.write">
      <PageHeader title="Add employee" description="You can add salary, bank details and login access on the next page." />
      <Card>
        <EmployeeForm
          submitLabel="Add employee"
          onCancel={() => router.back()}
          onSubmit={async (values) => {
            const employee = await api<Employee>("POST", "/employees", values);
            router.push(`/employees/${employee.id}`);
          }}
        />
      </Card>
    </RequirePermission>
  );
}
