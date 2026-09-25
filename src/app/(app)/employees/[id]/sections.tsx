"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { formatDate, formatMoney, humanize, todayInput, toDateInput } from "@/lib/format";
import type { EmployeeProfile, Loan, Role, SalaryComponentType, SalaryStructure } from "@/lib/types";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Table, Td, Th } from "@/components/ui";

// Runs an action with a busy flag and error message — every section here
// has the same "save, then reload the profile" shape.
function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run, setError };
}

// --- Emergency contacts -----------------------------------------------------

export function ContactsSection({ employee, onChange }: { employee: EmployeeProfile; onChange: () => void }) {
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", relationship: "", phone: "", isPrimary: false });
  const action = useAction();

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const ok = await action.run(() => api("POST", `/employees/${employee.id}/emergency-contacts`, form));
    if (ok) {
      setOpen(false);
      setForm({ name: "", relationship: "", phone: "", isPrimary: false });
      onChange();
    }
  }

  return (
    <Card
      title="Emergency contacts"
      padded={false}
      actions={
        can("hrm.employee.write") && (
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Add
          </Button>
        )
      }
    >
      {employee.emergencyContacts.length === 0 ? (
        <EmptyState title="No emergency contacts" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {employee.emergencyContacts.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <div>
                <p className="font-medium">
                  {c.name} {c.isPrimary && <Badge tone="blue">Primary</Badge>}
                </p>
                <p className="text-slate-500">
                  {c.relationship} · {c.phone}
                </p>
              </div>
              {can("hrm.employee.write") && (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove ${c.name}`}
                  onClick={() => action.run(async () => {
                    await api("DELETE", `/employees/${employee.id}/emergency-contacts/${c.id}`);
                    onChange();
                  })}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Add emergency contact">
        <form onSubmit={add} className="space-y-4">
          {action.error && <Alert>{action.error}</Alert>}
          <Field label="Name">
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Relationship">
            <Input required placeholder="Spouse, parent, sibling…" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isPrimary} onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })} />
            Primary contact
          </label>
          <div className="flex justify-end">
            <Button type="submit" loading={action.busy}>Add contact</Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

// --- Documents -------------------------------------------------------------

export function DocumentsSection({ employee, onChange }: { employee: EmployeeProfile; onChange: () => void }) {
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: "", fileUrl: "", expiryDate: "" });
  const action = useAction();
  const today = todayInput();

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const ok = await action.run(() =>
      api("POST", `/employees/${employee.id}/documents`, {
        category: form.category,
        fileUrl: form.fileUrl,
        expiryDate: form.expiryDate || undefined,
      }),
    );
    if (ok) {
      setOpen(false);
      setForm({ category: "", fileUrl: "", expiryDate: "" });
      onChange();
    }
  }

  return (
    <Card
      title="Documents"
      padded={false}
      actions={
        can("hrm.employee.write") && (
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Add
          </Button>
        )
      }
    >
      {employee.documents.length === 0 ? (
        <EmptyState title="No documents" description="CNIC, contract, degree certificates and so on." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {employee.documents.map((d) => {
            const expired = d.expiryDate && toDateInput(d.expiryDate) < today;
            return (
              <li key={d.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <a href={d.fileUrl} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">
                    {d.category}
                  </a>
                  <p className="text-slate-500">
                    Added {formatDate(d.uploadedAt)}
                    {d.expiryDate && (
                      <>
                        {" · "}
                        <span className={expired ? "font-medium text-red-600" : undefined}>
                          {expired ? "Expired" : "Expires"} {formatDate(d.expiryDate)}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                {can("hrm.employee.write") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove ${d.category}`}
                    onClick={() => action.run(async () => {
                      await api("DELETE", `/employees/${employee.id}/documents/${d.id}`);
                      onChange();
                    })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Add document">
        <form onSubmit={add} className="space-y-4">
          {action.error && <Alert>{action.error}</Alert>}
          <Field label="Document type">
            <Input required placeholder="CNIC, Contract, Degree…" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </Field>
          <Field label="Link to the file" hint="File upload isn't built yet — paste a link to where the file is stored (e.g. Google Drive).">
            <Input type="url" required placeholder="https://" value={form.fileUrl} onChange={(e) => setForm({ ...form, fileUrl: e.target.value })} />
          </Field>
          <Field label="Expiry date (optional)">
            <Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={action.busy}>Add document</Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

// --- Bank details ----------------------------------------------------------

export function BankSection({ employee, onChange }: { employee: EmployeeProfile; onChange: () => void }) {
  const { can } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    bankName: employee.bankDetail?.bankName ?? "",
    accountTitle: employee.bankDetail?.accountTitle ?? `${employee.firstName} ${employee.lastName}`,
    accountNumber: "",
    branchCode: employee.bankDetail?.branchCode ?? "",
  });
  const action = useAction();
  const bank = employee.bankDetail;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const ok = await action.run(() =>
      api("PUT", `/employees/${employee.id}/bank-detail`, { ...form, branchCode: form.branchCode || undefined }),
    );
    if (ok) {
      setEditing(false);
      setForm((f) => ({ ...f, accountNumber: "" }));
      onChange();
    }
  }

  return (
    <Card
      title="Bank account"
      actions={
        can("hrm.employee.write") && !editing && (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            {bank ? "Change" : "Add"}
          </Button>
        )
      }
    >
      {editing ? (
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          {action.error && (
            <div className="sm:col-span-2">
              <Alert>{action.error}</Alert>
            </div>
          )}
          <Field label="Bank">
            <Input required value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
          </Field>
          <Field label="Account title">
            <Input required value={form.accountTitle} onChange={(e) => setForm({ ...form, accountTitle: e.target.value })} />
          </Field>
          <Field label="Account number / IBAN" hint={bank ? "Enter the full number again to change it" : undefined}>
            <Input required autoComplete="off" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} />
          </Field>
          <Field label="Branch code (optional)">
            <Input value={form.branchCode} onChange={(e) => setForm({ ...form, branchCode: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={action.busy}>Save</Button>
          </div>
        </form>
      ) : bank ? (
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Bank</dt>
            <dd className="font-medium">{bank.bankName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Account title</dt>
            <dd className="font-medium">{bank.accountTitle}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Account number</dt>
            <dd className="font-mono font-medium">•••• {bank.accountNumberLast4 ?? "????"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Branch code</dt>
            <dd className="font-medium">{bank.branchCode ?? "—"}</dd>
          </div>
          <p className="text-xs text-slate-500 sm:col-span-2">The full account number is stored encrypted and never shown.</p>
        </dl>
      ) : (
        <p className="text-sm text-slate-500">No bank account on file.</p>
      )}
    </Card>
  );
}

// --- Salary & loans ---------------------------------------------------------

interface ComponentRow {
  name: string;
  type: SalaryComponentType;
  isTaxable: boolean;
  amount: string;
}

export function PaySection({ employee }: { employee: EmployeeProfile }) {
  const { can, me } = useAuth();
  const salary = useApi<SalaryStructure | null>(`/employees/${employee.id}/salary-structure`);
  const loans = useApi<Loan[]>(`/employees/${employee.id}/loans`);
  const [editing, setEditing] = useState(false);
  const [loanOpen, setLoanOpen] = useState(false);
  const canWrite = can("hrm.payroll.write");
  const currency = salary.data?.currency ?? me?.organization.currency ?? "PKR";

  const s = salary.data;
  const earnings = s?.components.filter((c) => c.component.type === "EARNING") ?? [];
  const gross = s ? Number(s.basicSalary) + earnings.reduce((sum, c) => sum + Number(c.amount), 0) : 0;

  return (
    <div className="space-y-6">
      <Card
        title="Salary"
        actions={
          canWrite && !editing && (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              {s ? "Change salary" : "Set salary"}
            </Button>
          )
        }
      >
        {editing ? (
          <SalaryEditor
            employeeId={employee.id}
            existing={s}
            defaultCurrency={currency}
            onDone={() => {
              setEditing(false);
              salary.reload();
            }}
          />
        ) : s ? (
          <div className="space-y-4 text-sm">
            <p className="text-slate-500">Effective from {formatDate(s.effectiveFrom)} · amounts per month</p>
            <Table>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <Td>Basic salary</Td>
                  <Td className="text-right font-medium">{formatMoney(s.basicSalary, s.currency)}</Td>
                </tr>
                {s.components.map((c) => (
                  <tr key={c.id}>
                    <Td>
                      {c.component.name}{" "}
                      <span className="text-xs text-slate-500">
                        ({humanize(c.component.type)}
                        {c.component.type === "EARNING" && !c.component.isTaxable ? ", not taxable" : ""})
                      </span>
                    </Td>
                    <Td className={`text-right font-medium ${c.component.type === "DEDUCTION" ? "text-red-600" : ""}`}>
                      {c.component.type === "DEDUCTION" ? "−" : ""}
                      {formatMoney(c.amount, s.currency)}
                    </Td>
                  </tr>
                ))}
                <tr className="bg-slate-50">
                  <Td className="font-semibold">Gross pay</Td>
                  <Td className="text-right font-semibold">{formatMoney(gross, s.currency)}</Td>
                </tr>
              </tbody>
            </Table>
            <p className="text-xs text-slate-500">Tax, EOBI and social security are worked out when payroll runs.</p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No salary set. This employee will be skipped when payroll runs.</p>
        )}
      </Card>

      <Card
        title="Loans & advances"
        padded={false}
        actions={
          canWrite && (
            <Button size="sm" variant="secondary" onClick={() => setLoanOpen(true)}>
              <Plus className="size-4" /> New loan
            </Button>
          )
        }
      >
        {!loans.data?.length ? (
          <EmptyState title="No loans" />
        ) : (
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <Th>Started</Th>
                <Th>Amount</Th>
                <Th>Monthly installment</Th>
                <Th>Remaining</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loans.data.map((l) => (
                <tr key={l.id}>
                  <Td>{formatDate(l.startDate)}</Td>
                  <Td>{formatMoney(l.principal, currency)}</Td>
                  <Td>{formatMoney(l.installmentAmount, currency)}</Td>
                  <Td>{formatMoney(l.remainingBalance, currency)}</Td>
                  <Td>
                    <Badge tone={l.status === "ACTIVE" ? "yellow" : "green"}>{humanize(l.status)}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <LoanModal
        open={loanOpen}
        employeeId={employee.id}
        onClose={() => setLoanOpen(false)}
        onDone={() => {
          setLoanOpen(false);
          loans.reload();
        }}
      />
    </div>
  );
}

function SalaryEditor({
  employeeId,
  existing,
  defaultCurrency,
  onDone,
}: {
  employeeId: string;
  existing: SalaryStructure | null;
  defaultCurrency: string;
  onDone: () => void;
}) {
  const [currency, setCurrency] = useState(existing?.currency ?? defaultCurrency);
  const [basic, setBasic] = useState(existing ? String(Number(existing.basicSalary)) : "");
  const [effectiveFrom, setEffectiveFrom] = useState(toDateInput(existing?.effectiveFrom) || todayInput());
  const [rows, setRows] = useState<ComponentRow[]>(
    existing?.components.map((c) => ({
      name: c.component.name,
      type: c.component.type,
      isTaxable: c.component.isTaxable,
      amount: String(Number(c.amount)),
    })) ?? [],
  );
  const action = useAction();

  const update = (i: number, patch: Partial<ComponentRow>) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const ok = await action.run(() =>
      api("POST", `/employees/${employeeId}/salary-structure`, {
        currency,
        basicSalary: Number(basic),
        effectiveFrom,
        components: rows.map((r) => ({ name: r.name.trim(), type: r.type, isTaxable: r.isTaxable, amount: Number(r.amount) })),
      }),
    );
    if (ok) onDone();
  }

  return (
    <form onSubmit={save} className="space-y-5">
      {action.error && <Alert>{action.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Basic salary (monthly)">
          <Input type="number" min={0} step="0.01" required value={basic} onChange={(e) => setBasic(e.target.value)} />
        </Field>
        <Field label="Currency">
          <Input required maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
        </Field>
        <Field label="Effective from">
          <Input type="date" required value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Allowances and deductions</p>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[2fr_1.5fr_1fr_auto_auto] sm:items-center">
              <Input required placeholder="e.g. House Rent" value={row.name} onChange={(e) => update(i, { name: e.target.value })} aria-label="Name" />
              <Select value={row.type} onChange={(e) => update(i, { type: e.target.value as SalaryComponentType })} aria-label="Type">
                <option value="EARNING">Allowance</option>
                <option value="DEDUCTION">Deduction</option>
                <option value="EMPLOYER_CONTRIBUTION">Employer contribution</option>
              </Select>
              <Input type="number" min={0} step="0.01" required placeholder="Amount" value={row.amount} onChange={(e) => update(i, { amount: e.target.value })} aria-label="Amount" />
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input type="checkbox" checked={row.isTaxable} disabled={row.type !== "EARNING"} onChange={(e) => update(i, { isTaxable: e.target.checked })} />
                Taxable
              </label>
              <Button type="button" size="sm" variant="ghost" aria-label="Remove" onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-2"
          onClick={() => setRows((r) => [...r, { name: "", type: "EARNING", isTaxable: true, amount: "" }])}
        >
          <Plus className="size-4" /> Add line
        </Button>
        <p className="mt-2 text-xs text-slate-500">
          A component name is shared across the company — its type and taxable setting are fixed the first time the name is used.
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={action.busy}>Save salary</Button>
      </div>
    </form>
  );
}

function LoanModal({ open, employeeId, onClose, onDone }: { open: boolean; employeeId: string; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ principal: "", installmentAmount: "", startDate: todayInput() });
  const action = useAction();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const ok = await action.run(() =>
      api("POST", `/employees/${employeeId}/loans`, {
        principal: Number(form.principal),
        installmentAmount: Number(form.installmentAmount),
        startDate: form.startDate,
      }),
    );
    if (ok) {
      setForm({ principal: "", installmentAmount: "", startDate: todayInput() });
      onDone();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New loan or advance">
      <form onSubmit={save} className="space-y-4">
        {action.error && <Alert>{action.error}</Alert>}
        <Field label="Amount">
          <Input type="number" min={1} step="0.01" required value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} />
        </Field>
        <Field label="Deduct each month" hint="Taken from pay every payroll run until it's paid back">
          <Input type="number" min={1} step="0.01" required value={form.installmentAmount} onChange={(e) => setForm({ ...form, installmentAmount: e.target.value })} />
        </Field>
        <Field label="Start deducting from">
          <Input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" loading={action.busy}>Create loan</Button>
        </div>
      </form>
    </Modal>
  );
}

// --- Login access ------------------------------------------------------------

export function AccessSection({ employee, onChange }: { employee: EmployeeProfile; onChange: () => void }) {
  const { me, refresh } = useAuth();
  const roles = useApi<Role[]>("/roles");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");
  const action = useAction();

  if (employee.userId) {
    return (
      <Card title="Login access">
        <p className="text-sm text-slate-600">
          {employee.userId === me?.user.id ? "This is your own profile — it's linked to your login." : `This employee can sign in with ${employee.email}.`}{" "}
          Change their roles or turn off their access under Settings → Users & roles.
        </p>
      </Card>
    );
  }

  const employeeRole = roles.data?.find((r) => r.name === "Employee");

  async function grant(e: React.FormEvent) {
    e.preventDefault();
    const ok = await action.run(() =>
      api("POST", `/employees/${employee.id}/login-access`, {
        password,
        roleIds: [roleId || employeeRole?.id].filter(Boolean),
      }),
    );
    if (ok) {
      setPassword("");
      onChange();
    }
  }

  async function linkMe() {
    const ok = await action.run(() => api("POST", `/employees/${employee.id}/login-access`, { userId: me!.user.id }));
    if (ok) {
      await refresh();
      onChange();
    }
  }

  return (
    <Card title="Login access">
      <div className="space-y-6">
        {action.error && <Alert>{action.error}</Alert>}
        <form onSubmit={grant} className="space-y-4">
          <p className="text-sm text-slate-600">
            Let {employee.firstName} sign in with <span className="font-medium">{employee.email}</span> to check in, request leave and download payslips.
            Share the starting password with them yourself.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starting password" hint="At least 8 characters">
              <Input type="text" autoComplete="off" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field label="Role">
              <Select value={roleId || employeeRole?.id || ""} onChange={(e) => setRoleId(e.target.value)}>
                {roles.data?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button type="submit" loading={action.busy}>Give login access</Button>
        </form>

        {!me?.employee && (
          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-600">Is this your own profile? Link it to the account you&apos;re signed in with.</p>
            <Button variant="secondary" className="mt-2" onClick={linkMe} loading={action.busy}>
              Link my account
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
