"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { formatDate, humanize } from "@/lib/format";
import type { Branch, Department, Employee, Paginated } from "@/lib/types";
import { Alert, Button, Card, EmptyState, Input, PageHeader, Select, Spinner, Table, Td, Th } from "@/components/ui";
import { EmployeeStatusBadge } from "@/components/status-badges";
import { RequirePermission } from "@/components/app-shell";
import { PersonAvatar } from "@/components/photo";

export default function EmployeesPage() {
  return (
    <RequirePermission permission="hrm.employee.read">
      <EmployeeDirectory />
    </RequirePermission>
  );
}

function EmployeeDirectory() {
  const { can } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced, status, branchId, departmentId]);

  const params = new URLSearchParams({ page: String(page), pageSize: "25" });
  if (debounced) params.set("search", debounced);
  if (status) params.set("status", status);
  if (branchId) params.set("branchId", branchId);
  if (departmentId) params.set("departmentId", departmentId);

  const { data, error, loading } = useApi<Paginated<Employee>>(`/employees?${params}`);
  const branches = useApi<Branch[]>("/branches");
  const departments = useApi<Department[]>("/departments");

  return (
    <>
      <PageHeader
        title="Employees"
        description={data ? `${data.total} ${data.total === 1 ? "person" : "people"}` : undefined}
        actions={
          can("hrm.employee.write") && (
            <Link href="/employees/new">
              <Button>
                <Plus className="size-4" /> Add employee
              </Button>
            </Link>
          )
        }
      />

      <Card padded={false}>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
            <Input
              type="search"
              placeholder="Search name, email, number"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              aria-label="Search employees"
            />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="">All statuses</option>
            {["ACTIVE", "ON_LEAVE", "SUSPENDED", "TERMINATED"].map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </Select>
          <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} aria-label="Branch">
            <option value="">All branches</option>
            {branches.data?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} aria-label="Department">
            <option value="">All departments</option>
            {departments.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>

        {error && (
          <div className="p-4">
            <Alert>{error}</Alert>
          </div>
        )}
        {loading && !data ? (
          <Spinner />
        ) : data && data.items.length === 0 ? (
          <EmptyState
            title={debounced || status || branchId || departmentId ? "No one matches these filters" : "No employees yet"}
            description={can("hrm.employee.write") ? "Add your first employee to get started." : undefined}
          />
        ) : (
          data && (
            <Table>
              <thead className="bg-slate-50">
                <tr>
                  <Th>Name</Th>
                  <Th>Number</Th>
                  <Th>Job title</Th>
                  <Th className="hidden md:table-cell">Department</Th>
                  <Th className="hidden lg:table-cell">Branch</Th>
                  <Th className="hidden md:table-cell">Joined</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.items.map((e) => (
                  <tr
                    key={e.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => router.push(`/employees/${e.id}`)}
                  >
                    <Td>
                      <div className="flex items-center gap-3">
                        <PersonAvatar person={e} photo={e.photoUpdatedAt ? { employeeId: e.id, updatedAt: e.photoUpdatedAt } : null} />
                        <div>
                          <Link href={`/employees/${e.id}`} className="font-medium text-slate-900 hover:text-brand-700" onClick={(ev) => ev.stopPropagation()}>
                            {e.firstName} {e.lastName}
                          </Link>
                          <div className="text-xs text-slate-500">{e.email}</div>
                        </div>
                      </div>
                    </Td>
                    <Td>{e.employeeNumber}</Td>
                    <Td>{e.designation}</Td>
                    <Td className="hidden md:table-cell">{e.department?.name ?? "—"}</Td>
                    <Td className="hidden lg:table-cell">{e.branch?.name ?? "—"}</Td>
                    <Td className="hidden md:table-cell">{formatDate(e.dateOfJoining)}</Td>
                    <Td>
                      <EmployeeStatusBadge status={e.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )
        )}

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
            <span>
              Page {data.page} of {data.totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="secondary" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
