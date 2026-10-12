"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import {
  downloadText,
  readSpreadsheet,
  rowsFromSheet,
  toCsv,
} from "@/lib/spreadsheet";
import {
  Alert,
  Badge,
  Button,
  Card,
  PageHeader,
  Spinner,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { RequirePermission } from "@/components/app-shell";

// Add many employees at once from an Excel or CSV file: download the template
// (or use your own sheet), upload it, see every row checked, then import
// everyone together. Nothing is saved until "Import".

interface Column {
  key: string;
  header: string;
  required: boolean;
  aliases: string[];
}

interface CheckResult {
  summary: {
    total: number;
    ready: number;
    withProblems: number;
    withBank: number;
    withSalary: number;
    withManager: number;
  };
  rows: {
    line: number;
    employeeNumber: string;
    name: string;
    ok: boolean;
    problems: string[];
    warnings: string[];
  }[];
}

const EXAMPLES: Record<string, string> = {
  employeeNumber: "EMP-014",
  dateOfJoining: "01/03/2024 (day first)",
  employmentType: "Full time, Part time, Contract, Intern",
  branch: "As named in Settings → Branches",
  department: "As named in Settings → Departments",
  managerNumber: "Their manager's employee number",
  cnic: "35202-1234567-1",
  gender: "Male, Female, Other",
  maritalStatus: "Single, Married…",
  bloodGroup: "B+",
  basicSalary: "85000",
  accountNumber: "Account number or IBAN",
};

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export default function ImportEmployeesPage() {
  return (
    <RequirePermission permission="hrm.employee.write">
      <ImportEmployees />
    </RequirePermission>
  );
}

function ImportEmployees() {
  const { can } = useAuth();
  const columns = useApi<Column[]>("/employees/import/columns");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [unknown, setUnknown] = useState<string[]>([]);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState<"reading" | "importing" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [giveLogin, setGiveLogin] = useState(false);
  const [done, setDone] = useState<{
    imported: number;
    logins: number;
    loginProblems: string[];
  } | null>(null);

  const known = useMemo(() => {
    const set = new Set<string>();
    for (const c of columns.data ?? [])
      [c.header, c.key, ...c.aliases].forEach((h) => set.add(squash(h)));
    return set;
  }, [columns.data]);

  function template() {
    const cols = columns.data ?? [];
    downloadText("employees-template.csv", toCsv([cols.map((c) => c.header)]));
  }

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setResult(null);
    setDone(null);
    setFileName(file.name);
    setBusy("reading");
    try {
      const cells = await readSpreadsheet(file);
      const data = rowsFromSheet(cells);
      if (!data.length)
        throw new Error("The file has headings but no people under them");
      setUnknown((cells[0] ?? []).filter((h) => h && !known.has(squash(h))));
      setRows(data);
      setResult(
        await api<CheckResult>("POST", "/employees/import/check", {
          rows: data,
        }),
      );
    } catch (err) {
      setRows(null);
      setError(err instanceof Error ? err.message : "Could not read that file");
    } finally {
      setBusy(null);
    }
  }

  async function runImport() {
    if (!rows) return;
    setBusy("importing");
    setError(null);
    try {
      setDone(await api("POST", "/employees/import", { rows, giveLogin }));
      setRows(null);
      setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import");
    } finally {
      setBusy(null);
    }
  }

  const shown = (result?.rows ?? []).filter((r) => !onlyProblems || !r.ok);
  const s = result?.summary;

  return (
    <div className="space-y-5">
      <Link
        href="/employees"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="size-4" /> Employees
      </Link>
      <PageHeader
        title="Import employees"
        description="Add many people at once from an Excel or CSV file. Nothing is saved until you press Import."
      />

      {done && (
        <Alert tone="success">
          {done.imported} {done.imported === 1 ? "person" : "people"} imported.
          {giveLogin &&
            ` ${done.logins} got a welcome email to choose their password.`}{" "}
          <Link href="/employees" className="font-medium underline">
            See the employee list
          </Link>
          {done.loginProblems.length > 0 && (
            <span className="mt-1 block">
              Logins not created: {done.loginProblems.join("; ")}
            </span>
          )}
        </Alert>
      )}
      {error && <Alert>{error}</Alert>}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="1. Get the template">
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              Download the template and fill one row per person, or use your own
              sheet: headings like &ldquo;Emp ID&rdquo;,
              &ldquo;Designation&rdquo; or &ldquo;DOJ&rdquo; are understood too.
            </p>
            <p>
              Add branches, departments and shifts in Settings first; the file
              uses their names.
            </p>
            <Button
              variant="secondary"
              onClick={template}
              disabled={!columns.data}
            >
              <Download className="size-4" /> Download template
            </Button>
          </div>
        </Card>
        <Card title="2. Upload your file">
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              Excel (.xlsx) or .csv, with the headings in the first row. Up to
              2,000 people per file.
            </p>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              <Upload className="size-4" />{" "}
              {busy === "reading" ? "Checking…" : "Choose file"}
              <input
                type="file"
                accept=".xlsx,.csv"
                className="sr-only"
                onChange={pick}
                disabled={busy !== null}
              />
            </label>
            {fileName && <p className="text-xs text-slate-500">{fileName}</p>}
          </div>
        </Card>
      </div>

      <Card padded={false}>
        <details>
          <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-[#1a1a2e]">
            See all columns{columns.data ? ` (${columns.data.length})` : ""} and
            how to fill them
          </summary>
          {columns.loading ? (
            <Spinner />
          ) : (
            <div className="overflow-x-auto border-t border-gray-100">
              <Table>
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Heading</Th>
                    <Th>Needed?</Th>
                    <Th>Example / how to fill</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(columns.data ?? []).map((c) => (
                    <tr key={c.key}>
                      <Td className="font-medium text-slate-800">{c.header}</Td>
                      <Td>
                        {c.required ? (
                          <Badge tone="blue">Required</Badge>
                        ) : (
                          <span className="text-slate-400">Optional</span>
                        )}
                      </Td>
                      <Td className="whitespace-normal text-slate-500">
                        {EXAMPLES[c.key] ?? ""}
                        {c.key === "basicSalary" &&
                          !can("hrm.payroll.write") &&
                          " (needs payroll access)"}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </details>
      </Card>

      {busy === "reading" && <Spinner label="Checking every row…" />}
      {result && s && (
        <Card title="3. Check and import">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge tone="green">{s.ready} ready</Badge>
              {s.withProblems > 0 && (
                <Badge tone="red">{s.withProblems} with problems</Badge>
              )}
              {s.withManager > 0 && (
                <Badge>{s.withManager} with a manager</Badge>
              )}
              {s.withSalary > 0 && <Badge>{s.withSalary} with salary</Badge>}
              {s.withBank > 0 && <Badge>{s.withBank} with bank details</Badge>}
            </div>
            {unknown.length > 0 && (
              <Alert tone="info">
                These columns aren&apos;t used and will be left out:{" "}
                {unknown.join(", ")}.
              </Alert>
            )}
            {s.withProblems > 0 ? (
              <Alert>
                Fix the rows marked below in your file, then choose it again.
                Nobody is imported until every row is ready.
              </Alert>
            ) : (
              <div className="space-y-3">
                {can("hrm.settings.write") && (
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={giveLogin}
                      onChange={(e) => setGiveLogin(e.target.checked)}
                    />
                    <span>
                      Give everyone a login
                      <span className="block text-xs text-slate-500">
                        Each person gets a welcome email with a link to choose
                        their own password.
                      </span>
                    </span>
                  </label>
                )}
                {s.withBank > 0 && (
                  <p className="text-xs text-slate-500">
                    Bank details are included, so you&apos;ll be asked for the
                    6-digit code from your authenticator app.
                  </p>
                )}
                <Button onClick={runImport} loading={busy === "importing"}>
                  Import {s.ready} {s.ready === 1 ? "person" : "people"}
                </Button>
              </div>
            )}

            {s.withProblems > 0 && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={onlyProblems}
                  onChange={(e) => setOnlyProblems(e.target.checked)}
                />{" "}
                Show only rows with problems
              </label>
            )}
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <Table>
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Row</Th>
                    <Th>Employee no.</Th>
                    <Th>Name</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shown.map((r) => (
                    <tr key={r.line} className="align-top">
                      <Td className="tabular-nums text-slate-500">{r.line}</Td>
                      <Td>{r.employeeNumber || "—"}</Td>
                      <Td>{r.name || "—"}</Td>
                      <Td className="whitespace-normal">
                        {r.ok ? (
                          <Badge tone="green">Ready</Badge>
                        ) : (
                          <Badge tone="red">
                            {r.problems.length === 1
                              ? "1 problem"
                              : `${r.problems.length} problems`}
                          </Badge>
                        )}
                        {r.problems.length > 0 && (
                          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-red-700">
                            {r.problems.map((p, i) => (
                              <li key={i}>{p}</li>
                            ))}
                          </ul>
                        )}
                        {r.warnings.length > 0 && (
                          <p className="mt-1 text-xs text-amber-700">
                            {r.warnings.join(" · ")}
                          </p>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
