"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth";
import type { Employee, Paginated } from "@/lib/types";
import { Alert, Badge, Button, Card, EmptyState, Spinner, Table, Td, Th } from "@/components/ui";

interface BankChange {
  id: string;
  employeeId: string;
  bankName: string;
  accountTitle: string;
  accountNumberLast4: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  requestedByUserId: string;
  decidedAt: string | null;
  note: string | null;
  createdAt: string;
}

// Settings › Security: two-step for everyone, and salary bank account
// changes waiting for a second person.
export function SecuritySettings() {
  const { me } = useAuth();
  const setting = useApi<{ requireTwoStepForAll: boolean }>("/settings/security");
  const changes = useApi<BankChange[]>("/bank-detail-changes");
  const people = useApi<Paginated<Employee>>("/employees?pageSize=100");
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const name = (id: string) => {
    const e = people.data?.items.find((x) => x.id === id);
    return e ? `${e.firstName} ${e.lastName}` : "Employee";
  };

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    setMessage(null);
    try {
      await fn();
      setMessage({ tone: "success", text: ok });
      changes.reload();
      setting.reload();
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Something went wrong" });
    } finally {
      setBusy(null);
    }
  }

  const pending = (changes.data ?? []).filter((c) => c.status === "PENDING");
  const past = (changes.data ?? []).filter((c) => c.status !== "PENDING").slice(0, 10);

  return (
    <div className="space-y-6">
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <Card title="Two-step sign-in">
        {!setting.data ? (
          <Spinner />
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-slate-600">Always required for anyone who handles pay, employee records or settings. Turn this on to require it for everyone, including employees.</p>
            <label className="flex items-center gap-2.5">
              <input
                type="checkbox"
                className="accent-brand-600"
                checked={setting.data.requireTwoStepForAll}
                disabled={busy === "setting"}
                onChange={(e) =>
                  run("setting", () => api("PATCH", "/settings/security", { requireTwoStepForAll: e.target.checked }), e.target.checked ? "Everyone must now use two-step sign-in." : "Two-step is now required only for people who handle pay, records or settings.")
                }
              />
              Require two-step sign-in for everyone in this company
            </label>
          </div>
        )}
      </Card>

      <Card title="Salary bank account changes" padded={false}>
        <p className="px-5 pt-4 text-sm text-slate-500">Changing an employee’s salary account waits for a second person, so nobody can quietly redirect someone’s pay.</p>
        {changes.loading && !changes.data ? (
          <div className="p-5">
            <Spinner />
          </div>
        ) : pending.length === 0 ? (
          <div className="p-5">
            <EmptyState title="Nothing waiting" description="Changes someone asks for show up here for approval." />
          </div>
        ) : (
          <div className="mt-3">
            <Table>
              <thead>
                <tr>
                  <Th>Employee</Th>
                  <Th>New account</Th>
                  <Th>Asked</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {pending.map((c) => {
                  const mine = c.requestedByUserId === me?.user.id;
                  return (
                    <tr key={c.id}>
                      <Td>{name(c.employeeId)}</Td>
                      <Td>
                        {c.bankName} · {c.accountTitle} · <span className="font-mono">****{c.accountNumberLast4}</span>
                      </Td>
                      <Td>{new Date(c.createdAt).toLocaleString()}</Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-2">
                          {!mine && (
                            <Button size="sm" loading={busy === `a${c.id}`} onClick={() => run(`a${c.id}`, () => api("POST", `/bank-detail-changes/${c.id}/approve`), "Approved — the new account is now used for pay.")}>
                              Approve
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={busy === `r${c.id}`}
                            onClick={() => {
                              const note = mine ? undefined : window.prompt("Why are you turning this down? (optional)") ?? undefined;
                              run(`r${c.id}`, () => api("POST", `/bank-detail-changes/${c.id}/reject`, { note }), mine ? "Cancelled." : "Turned down.");
                            }}
                          >
                            {mine ? "Cancel" : "Turn down"}
                          </Button>
                        </div>
                        {mine && <p className="mt-1 text-xs text-slate-400">A different person has to approve this.</p>}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
        {past.length > 0 && (
          <div className="border-t border-slate-100 px-5 py-3 text-sm">
            <p className="mb-2 font-medium text-slate-700">Earlier</p>
            <ul className="space-y-1.5">
              {past.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2 text-slate-600">
                  <Badge tone={c.status === "APPROVED" ? "green" : c.status === "REJECTED" ? "red" : "gray"}>{c.status.toLowerCase()}</Badge>
                  {name(c.employeeId)} → ****{c.accountNumberLast4}
                  {c.note && <span className="text-slate-400">· {c.note}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}

// "Record checked · untouched" for the activity history. Normally only entries added
// since the last check are read; "Check the whole record" re-reads everything.
export function ActivityCheck() {
  const [full, setFull] = useState(false);
  const check = useApi<{ entries: number; intact: boolean; brokenAt: number | null; full?: boolean }>(full ? "/activity/verify?full=1" : "/activity/verify");
  if (!check.data) return null;
  return check.data.intact ? (
    <span className="inline-flex items-center gap-2">
      <Badge tone="green">{check.data.full ? "Whole record checked" : "Record checked"} · untouched</Badge>
      {!check.data.full && (
        <button type="button" className="text-xs text-slate-500 underline hover:text-slate-700" disabled={check.loading} onClick={() => setFull(true)}>
          {check.loading ? "Checking…" : "Check the whole record"}
        </button>
      )}
    </span>
  ) : (
    <Badge tone="red">Entry #{check.data.brokenAt} was changed — contact Quscer support</Badge>
  );
}
