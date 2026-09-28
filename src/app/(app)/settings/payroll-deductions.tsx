"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { fullName } from "@/lib/format";
import { countryLabel, regionName, regionsOf } from "@/lib/geo";
import type { CompanyDeduction, DeductionMethod, Employee, Paginated } from "@/lib/types";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, Table, Td, Th } from "@/components/ui";
import { CountryPicker, RegionSelect } from "@/components/geo-pickers";

// Settings → Payroll deductions: tax and contributions a company sets up
// itself, for countries without built-in rules or for its own schemes.

type List = { items: CompanyDeduction[]; builtIn: { countryCode: string; ruleTypes: string[] }[] };

const METHODS: { id: DeductionMethod; label: string }[] = [
  { id: "PERCENT_OF_BASIC", label: "% of basic" },
  { id: "PERCENT_OF_GROSS", label: "% of gross" },
  { id: "FIXED_AMOUNT", label: "Fixed amount" },
  { id: "TAX_SLABS", label: "Tax bands" },
];
const RULE_NAMES: Record<string, string> = { INCOME_TAX: "Income tax", PENSION_FUND: "pension fund", SOCIAL_SECURITY: "social security" };

type Band = { upTo: string; ratePercent: string };
type Form = {
  name: string;
  countryCode: string;
  regionCode: string;
  method: DeductionMethod;
  employeePercent: string;
  employerPercent: string;
  employeeAmount: string;
  employerAmount: string;
  wageCap: string;
  currency: string;
  slabs: Band[];
  appliesToAll: boolean;
  employeeIds: string[];
  reducesTaxablePay: boolean;
  effectiveFrom: string;
  effectiveTo: string;
  sourceRef: string;
};

const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));
const thisMonth = () => new Date().toISOString().slice(0, 7);

function toForm(d: CompanyDeduction | null): Form {
  return {
    name: d?.name ?? "",
    countryCode: d ? (d.countryCode ?? "") : "",
    regionCode: d?.regionCode ?? "",
    method: d?.method ?? "PERCENT_OF_BASIC",
    employeePercent: str(d?.employeePercent),
    employerPercent: str(d?.employerPercent),
    employeeAmount: str(d?.employeeAmount),
    employerAmount: str(d?.employerAmount),
    wageCap: str(d?.wageCap),
    currency: d?.currency ?? "",
    slabs: d?.slabs?.map((s) => ({ upTo: str(s.upTo), ratePercent: str(s.ratePercent) })) ?? [
      { upTo: "", ratePercent: "0" },
      { upTo: "", ratePercent: "" },
    ],
    appliesToAll: d?.appliesToAll ?? true,
    employeeIds: d?.employeeIds ?? [],
    reducesTaxablePay: d?.reducesTaxablePay ?? false,
    effectiveFrom: d?.effectiveFrom ?? thisMonth(),
    effectiveTo: d?.effectiveTo ?? "",
    sourceRef: d?.sourceRef ?? "",
  };
}

function toPayload(f: Form) {
  const n = (v: string) => (v.trim() === "" ? null : Number(v));
  const percent = f.method === "PERCENT_OF_BASIC" || f.method === "PERCENT_OF_GROSS";
  return {
    name: f.name.trim(),
    countryCode: f.countryCode || null,
    regionCode: f.countryCode && f.regionCode ? f.regionCode : null,
    method: f.method,
    employeePercent: percent ? (n(f.employeePercent) ?? 0) : null,
    employerPercent: percent ? (n(f.employerPercent) ?? 0) : null,
    employeeAmount: f.method === "FIXED_AMOUNT" ? (n(f.employeeAmount) ?? 0) : null,
    employerAmount: f.method === "FIXED_AMOUNT" ? (n(f.employerAmount) ?? 0) : null,
    wageCap: percent ? n(f.wageCap) : null,
    slabs:
      f.method === "TAX_SLABS"
        ? f.slabs.map((s, i) => ({ upTo: i === f.slabs.length - 1 ? null : n(s.upTo), ratePercent: n(s.ratePercent) ?? 0 }))
        : null,
    currency: f.currency.trim().toUpperCase() || null,
    appliesToAll: f.appliesToAll,
    employeeIds: f.appliesToAll ? [] : f.employeeIds,
    reducesTaxablePay: f.method !== "TAX_SLABS" && f.reducesTaxablePay,
    effectiveFrom: f.effectiveFrom,
    effectiveTo: f.effectiveTo || null,
    sourceRef: f.sourceRef.trim() || null,
  };
}

const money = (n: number | null, currency: string | null) => (n ? `${currency ?? ""} ${n.toLocaleString()}`.trim() : "—");
const month = (key: string) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

function share(d: CompanyDeduction, who: "employee" | "employer"): string {
  const pct = who === "employee" ? d.employeePercent : d.employerPercent;
  switch (d.method) {
    case "PERCENT_OF_BASIC":
    case "PERCENT_OF_GROSS":
      return pct ? `${pct}% of ${d.method === "PERCENT_OF_BASIC" ? "basic" : "gross"}${d.wageCap ? ` (up to ${money(d.wageCap, d.currency)})` : ""}` : "—";
    case "FIXED_AMOUNT":
      return money(who === "employee" ? d.employeeAmount : d.employerAmount, d.currency);
    case "TAX_SLABS":
      return who === "employee" ? (d.slabs ?? []).map((s) => `${s.ratePercent}%`).join(" → ") : "—";
  }
}

export function PayrollDeductions() {
  const list = useApi<List>("/payroll-deductions");
  const people = useApi<Paginated<Employee>>("/employees?pageSize=100&status=ACTIVE");
  const [editing, setEditing] = useState<CompanyDeduction | "new" | null>(null);
  const [form, setForm] = useState<Form>(() => toForm(null));
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  function open(d: CompanyDeduction | "new") {
    setForm(toForm(d === "new" ? null : d));
    setError(null);
    setEditing(d);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editing === "new") await api("POST", "/payroll-deductions", toPayload(form));
      else if (editing) await api("PATCH", `/payroll-deductions/${editing.id}`, toPayload(form));
      setEditing(null);
      list.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function remove(d: CompanyDeduction) {
    if (!window.confirm(`Remove “${d.name}”? Payslips already made keep it.`)) return;
    setListError(null);
    try {
      await api("DELETE", `/payroll-deductions/${d.id}`);
      list.reload();
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Could not remove");
    }
  }

  const nameOf = (id: string) => {
    const p = people.data?.items.find((x) => x.id === id);
    return p ? fullName(p) : "Someone who has left";
  };
  const where = (d: CompanyDeduction) =>
    d.countryCode ? `${countryLabel(d.countryCode)}${d.regionCode ? ` · ${regionName(d.regionCode, d.countryCode)}` : ""}` : "All countries";

  const percent = form.method === "PERCENT_OF_BASIC" || form.method === "PERCENT_OF_GROSS";
  const needsCurrency = form.method === "FIXED_AMOUNT" || form.method === "TAX_SLABS" || (percent && form.wageCap.trim() !== "");
  const chosen = new Set(form.employeeIds);

  return (
    <Card
      title="Payroll deductions"
      padded={false}
      actions={
        <Button size="sm" onClick={() => open("new")}>
          <Plus className="size-4" /> Add deduction
        </Button>
      }
    >
      <p className="border-b border-slate-100 px-5 py-2 text-xs text-slate-500">
        Quscer has built-in tax and social security rules for Pakistan. For other countries — or for your own company schemes — add the
        deductions here and payroll will apply them.
      </p>
      {(listError || list.error) && (
        <div className="p-4">
          <Alert>{listError ?? list.error}</Alert>
        </div>
      )}
      {list.loading && !list.data ? (
        <Spinner />
      ) : (
        <>
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <Th>Deduction</Th>
                <Th>Where</Th>
                <Th>Employee pays</Th>
                <Th>Company pays</Th>
                <Th>Who</Th>
                <Th>From</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.data?.builtIn.map((b) => (
                <tr key={b.countryCode} className="bg-slate-50/60">
                  <Td>
                    <span className="font-medium text-slate-900">
                      {b.ruleTypes
                        .map((t) => RULE_NAMES[t])
                        .filter(Boolean)
                        .join(", ")}
                    </span>{" "}
                    <Badge>Built in</Badge>
                  </Td>
                  <Td>{countryLabel(b.countryCode)}</Td>
                  <Td className="text-slate-500">By law</Td>
                  <Td className="text-slate-500">By law</Td>
                  <Td>Everyone</Td>
                  <Td className="text-slate-500">—</Td>
                  <Td />
                </tr>
              ))}
              {list.data?.items.map((d) => (
                <tr key={d.id}>
                  <Td>
                    <span className="font-medium text-slate-900">{d.name}</span>{" "}
                    {d.method === "TAX_SLABS" && <Badge tone="blue">Tax bands</Badge>}
                    {d.reducesTaxablePay && <Badge tone="green">Before tax</Badge>}
                  </Td>
                  <Td>{where(d)}</Td>
                  <Td>{share(d, "employee")}</Td>
                  <Td>{share(d, "employer")}</Td>
                  <Td>{d.appliesToAll ? "Everyone" : `${d.employeeIds.length} chosen ${d.employeeIds.length === 1 ? "person" : "people"}`}</Td>
                  <Td>
                    {month(d.effectiveFrom)}
                    {d.effectiveTo && ` – ${month(d.effectiveTo)}`}
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    <Button size="sm" variant="ghost" aria-label={`Edit ${d.name}`} onClick={() => open(d)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="sm" variant="ghost" aria-label={`Remove ${d.name}`} onClick={() => remove(d)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {!list.data?.items.length && (
            <EmptyState title="No deductions of your own yet" description="Add one for a country Quscer doesn't have rules for, or for a company scheme." />
          )}
        </>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add deduction" : "Edit deduction"} wide>
        <form onSubmit={save} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <Field label="Name on payslip">
            <Input required maxLength={80} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Pension (GPSSA)" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Country">
              <CountryPicker value={form.countryCode} onChange={(code) => set({ countryCode: code, regionCode: "" })} emptyLabel="All countries" />
            </Field>
            <Field label="Province / state">
              <RegionSelect
                country={form.countryCode || null}
                value={form.regionCode}
                onChange={(code) => set({ regionCode: code })}
                emptyLabel={form.countryCode ? (regionsOf(form.countryCode).length ? "Whole country" : "None listed for this country") : "Choose a country first"}
              />
            </Field>
          </div>

          <fieldset>
            <legend className="mb-1 text-sm font-medium text-slate-700">How it&apos;s worked out</legend>
            <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 sm:grid-cols-4" role="radiogroup">
              {METHODS.map((m) => (
                <label
                  key={m.id}
                  className={`cursor-pointer border-slate-200 px-2 py-2 text-center text-sm not-last:border-r ${form.method === m.id ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  <input type="radio" name="method" className="sr-only" checked={form.method === m.id} onChange={() => set({ method: m.id })} />
                  {m.label}
                </label>
              ))}
            </div>
          </fieldset>

          {percent && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Employee pays (%)" hint="Taken from their pay.">
                <Input type="number" min={0} max={100} step="any" value={form.employeePercent} onChange={(e) => set({ employeePercent: e.target.value })} />
              </Field>
              <Field label="Company pays (%)" hint="Shown as a company cost.">
                <Input type="number" min={0} max={100} step="any" value={form.employerPercent} onChange={(e) => set({ employerPercent: e.target.value })} />
              </Field>
              <Field label="Only on salary up to (optional)" hint="Per month. Leave empty for no limit.">
                <Input type="number" min={0} step="any" value={form.wageCap} onChange={(e) => set({ wageCap: e.target.value })} placeholder="No limit" />
              </Field>
            </div>
          )}
          {form.method === "FIXED_AMOUNT" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Employee pays (per month)">
                <Input type="number" min={0} step="any" value={form.employeeAmount} onChange={(e) => set({ employeeAmount: e.target.value })} />
              </Field>
              <Field label="Company pays (per month)">
                <Input type="number" min={0} step="any" value={form.employerAmount} onChange={(e) => set({ employerAmount: e.target.value })} />
              </Field>
            </div>
          )}
          {form.method === "TAX_SLABS" && (
            <fieldset>
              <legend className="mb-1 text-sm font-medium text-slate-700">Yearly tax bands</legend>
              <p className="mb-2 text-xs text-slate-500">
                On taxable pay for the year, lowest band first. Worked out each month on that month&apos;s pay × 12, then divided by 12.
              </p>
              <div className="space-y-2">
                {form.slabs.map((s, i) => {
                  const last = i === form.slabs.length - 1;
                  const from = i === 0 ? "0" : form.slabs[i - 1].upTo || "…";
                  return (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-24 shrink-0 text-slate-500">{i === 0 ? "From 0" : `Above ${from}`}</span>
                      {last ? (
                        <span className="w-40 shrink-0 text-slate-500">and everything above</span>
                      ) : (
                        <Input
                          aria-label={`Band ${i + 1} up to`}
                          type="number"
                          min={0}
                          step="any"
                          required
                          className="w-40"
                          placeholder="up to"
                          value={s.upTo}
                          onChange={(e) => set({ slabs: form.slabs.map((x, j) => (j === i ? { ...x, upTo: e.target.value } : x)) })}
                        />
                      )}
                      <Input
                        aria-label={`Band ${i + 1} rate`}
                        type="number"
                        min={0}
                        max={100}
                        step="any"
                        required
                        className="w-24"
                        value={s.ratePercent}
                        onChange={(e) => set({ slabs: form.slabs.map((x, j) => (j === i ? { ...x, ratePercent: e.target.value } : x)) })}
                      />
                      <span className="text-slate-500">%</span>
                      {form.slabs.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Remove band ${i + 1}`}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          onClick={() => set({ slabs: form.slabs.filter((_, j) => j !== i) })}
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="mt-2"
                onClick={() => set({ slabs: [...form.slabs.slice(0, -1), { upTo: "", ratePercent: "" }, form.slabs[form.slabs.length - 1]] })}
              >
                <Plus className="size-4" /> Add band
              </Button>
            </fieldset>
          )}
          {needsCurrency && (
            <Field label="Currency" hint="Of the salaries it applies to, e.g. AED. People paid in another currency are skipped and listed in payroll.">
              <Input required maxLength={3} className="w-28 uppercase" value={form.currency} onChange={(e) => set({ currency: e.target.value.toUpperCase() })} />
            </Field>
          )}

          <fieldset>
            <legend className="mb-1 text-sm font-medium text-slate-700">Who it applies to</legend>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="who" checked={form.appliesToAll} onChange={() => set({ appliesToAll: true })} />
                {form.countryCode ? "Everyone there" : "Everyone"}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="who" checked={!form.appliesToAll} onChange={() => set({ appliesToAll: false })} />
                Chosen people
              </label>
            </div>
            {!form.appliesToAll && (
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {form.employeeIds.map((id) => (
                    <span key={id} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      {nameOf(id)}
                      <button type="button" aria-label={`Remove ${nameOf(id)}`} onClick={() => set({ employeeIds: form.employeeIds.filter((x) => x !== id) })}>
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                  {!form.employeeIds.length && <span className="text-xs text-slate-500">Nobody chosen yet.</span>}
                </div>
                <Select aria-label="Add a person" value="" onChange={(e) => e.target.value && set({ employeeIds: [...form.employeeIds, e.target.value] })}>
                  <option value="">Add a person…</option>
                  {people.data?.items
                    .filter((p) => !chosen.has(p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {fullName(p)} · {p.employeeNumber}
                      </option>
                    ))}
                </Select>
              </div>
            )}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts from">
              <Input type="month" required value={form.effectiveFrom} onChange={(e) => set({ effectiveFrom: e.target.value })} />
            </Field>
            <Field label="Last month (optional)" hint="Leave empty if it carries on.">
              <Input type="month" min={form.effectiveFrom} value={form.effectiveTo} onChange={(e) => set({ effectiveTo: e.target.value })} />
            </Field>
          </div>
          {form.method !== "TAX_SLABS" && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5" checked={form.reducesTaxablePay} onChange={(e) => set({ reducesTaxablePay: e.target.checked })} />
              <span>
                Take the employee&apos;s part off their pay before income tax
                <span className="block text-xs text-slate-500">For pension schemes that are paid from pay before tax.</span>
              </span>
            </label>
          )}
          <Field label="Where this rule comes from (optional)">
            <Input maxLength={200} value={form.sourceRef} onChange={(e) => set({ sourceRef: e.target.value })} placeholder="e.g. Federal Law No. 7 of 1999" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save deduction
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
