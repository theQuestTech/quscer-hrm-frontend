"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { type CompanyDetail, type CompanyLogin, supportApi, useSupportApi } from "@/lib/support";
import { formatDate, formatRelative } from "@/lib/format";
import { EMAIL_KIND, EmailBadge, TicketBadge, ViewAsModal, activityText } from "@/components/support";
import { Alert, Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Spinner, Table, Td, Textarea, Th } from "@/components/ui";

const CHECK_IN: Record<CompanyDetail["setup"]["checkInMethod"], string> = { APP: "App only", MACHINE: "Machine only", BOTH: "App + machine" };

export default function CompanyPage() {
  const { id } = useParams<{ id: string }>();
  const company = useSupportApi<CompanyDetail>(`/support/companies/${id}`);
  const [viewing, setViewing] = useState<CompanyLogin | "pick" | null>(null);
  const [switching, setSwitching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  if (company.loading && !company.data) return <Spinner />;
  if (company.error) return <Alert>{company.error}</Alert>;
  const c = company.data;
  if (!c) return null;
  const people = c.logins.filter((l) => l.canLogIn);

  async function act(key: string, path: string, done: string) {
    setBusy(key);
    setNotice(null);
    try {
      await supportApi("POST", path);
      setNotice({ tone: "success", text: done });
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Something went wrong" });
    } finally {
      setBusy(null);
      company.reload();
    }
  }

  return (
    <>
      <Link href="/support" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="size-4" /> Companies
      </Link>
      <PageHeader
        title={c.name}
        description={`Since ${formatDate(c.createdAt)} · ${c.employees} employee${c.employees === 1 ? "" : "s"} · ${people.length} login${people.length === 1 ? "" : "s"} · ${c.timezone}`}
        actions={
          <>
            {!c.suspendedAt && (
              <Button variant="secondary" onClick={() => setViewing("pick")} disabled={!people.length}>
                View as a user
              </Button>
            )}
            {c.suspendedAt ? (
              <Button loading={busy === "resume"} onClick={() => act("resume", `/support/companies/${id}/resume`, "The company is switched back on.")}>
                Switch company back on
              </Button>
            ) : (
              <Button variant="secondary" className="!text-red-700 !ring-red-200" onClick={() => setSwitching(true)}>
                Switch company off
              </Button>
            )}
          </>
        }
      />
      {c.suspendedAt && (
        <div className="mb-4">
          <Alert>
            Switched off on {formatDate(c.suspendedAt)} — “{c.suspendedReason}”. Nobody can sign in, no emails go out and the careers page is hidden. Their data is kept.
          </Alert>
        </div>
      )}
      {notice && (
        <div className="mb-4">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="min-w-0 space-y-5">
          <Card title="People who can log in" padded={false}>
            <Table>
              <thead className="bg-slate-50">
                <tr>
                  <Th>Person</Th>
                  <Th>Roles</Th>
                  <Th>Last seen</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {c.logins.map((l) => (
                  <tr key={l.id} className={l.canLogIn ? undefined : "opacity-50"}>
                    <Td>
                      <p className="font-medium text-slate-900">
                        {l.firstName} {l.lastName}
                      </p>
                      <p className="text-xs text-slate-500">{l.email}</p>
                    </Td>
                    <Td className="whitespace-normal text-xs">{l.roles.join(", ") || "—"}</Td>
                    <Td>{!l.canLogIn ? "Login switched off" : l.lastSeenAt ? formatRelative(l.lastSeenAt) : "Never"}</Td>
                    <Td className="text-right">
                      {l.canLogIn && (
                        <div className="flex justify-end gap-1">
                          {!l.lastSeenAt ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={busy === `welcome-${l.id}`}
                              onClick={() => act(`welcome-${l.id}`, `/support/companies/${id}/users/${l.id}/welcome`, `Welcome email sent to ${l.email}.`)}
                            >
                              Resend welcome
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={busy === `reset-${l.id}`}
                              onClick={() => act(`reset-${l.id}`, `/support/companies/${id}/users/${l.id}/reset-link`, `Password reset link sent to ${l.email}.`)}
                            >
                              Send reset link
                            </Button>
                          )}
                          {!c.suspendedAt && (
                            <Button size="sm" variant="ghost" onClick={() => setViewing(l)}>
                              View as
                            </Button>
                          )}
                        </div>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card title="Emails (last 7 days)" padded={false}>
            {!c.emails.length ? (
              <EmptyState title="No emails in the last 7 days" />
            ) : (
              <Table>
                <thead className="bg-slate-50">
                  <tr>
                    <Th>To</Th>
                    <Th>What</Th>
                    <Th>When</Th>
                    <Th>Result</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {c.emails.map((e) => (
                    <tr key={e.id}>
                      <Td>{e.to}</Td>
                      <Td>
                        <span title={e.subject}>{EMAIL_KIND[e.kind] ?? e.kind}</span>
                      </Td>
                      <Td>{formatRelative(e.createdAt)}</Td>
                      <Td className="whitespace-normal">
                        <EmailBadge status={e.status} />
                        {e.error && <p className="mt-1 max-w-xs text-xs text-red-700">{e.error}</p>}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          {c.machines.length > 0 && (
            <Card title="Attendance machines" padded={false}>
              <Table>
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Machine</Th>
                    <Th>Status</Th>
                    <Th>Last punch</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {c.machines.map((m) => (
                    <tr key={m.id}>
                      <Td>
                        <p className="font-medium text-slate-900">{m.name}</p>
                        <p className="text-xs text-slate-500">
                          {m.kind === "ADMS" ? `ZKTeco · serial ${m.serialNumber}` : m.kind === "API" ? "API connection" : "File upload"}
                        </p>
                      </Td>
                      <Td>
                        <MachineStatus m={m} />
                      </Td>
                      <Td>{m.lastPunchAt ? formatRelative(m.lastPunchAt) : "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-5">
          <Card title="Setup">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Item label="Email notifications" value={c.setup.emailNotifications ? "On" : "Off"} />
              <Item label="Check-in" value={CHECK_IN[c.setup.checkInMethod]} />
              <Item
                label="App check-in limits"
                value={[c.setup.officeNetworkRequired && "Office network", c.setup.officeLocationRequired && "Office location"].filter(Boolean).join(", ") || "None"}
              />
              <Item label="Branches" value={String(c.branches)} />
              <Item label="Payroll runs" value={String(c.payrollRuns)} />
              <Item label="Modules" value={c.setup.modules.join(", ") || "Core only"} />
            </dl>
          </Card>

          <Card title="Help requests" padded={false}>
            {!c.tickets.length ? (
              <EmptyState title="None yet" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {c.tickets.map((t) => (
                  <li key={t.id} className="px-5 py-3">
                    <Link href={`/support/tickets/${t.id}`} className="text-sm font-medium text-slate-900 hover:text-[#00857a] hover:underline">
                      {t.subject}
                    </Link>{" "}
                    <TicketBadge status={t.status} />
                    <p className="text-xs text-slate-500">
                      {t.user.firstName} {t.user.lastName} · {formatRelative(t.lastMessageAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="What support did here" padded={false}>
            {!c.actions.length ? (
              <EmptyState title="Nothing yet" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {c.actions.map((a) => (
                  <li key={a.id} className="px-5 py-3 text-sm">
                    <span className="font-medium">{a.agentName}</span> {activityText(a)}
                    <p className="text-xs text-slate-400">{new Date(a.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {viewing && (
        <ViewAsModal
          organizationId={c.id}
          people={viewing === "pick" ? people : [viewing]}
          initialUserId={viewing === "pick" ? undefined : viewing.id}
          onClose={() => setViewing(null)}
          onStarted={() => company.reload()}
        />
      )}
      {switching && (
        <SwitchOffModal
          name={c.name}
          onClose={() => setSwitching(false)}
          onDone={() => {
            setSwitching(false);
            setNotice({ tone: "success", text: `${c.name} is switched off.` });
            company.reload();
          }}
          id={c.id}
        />
      )}
    </>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function MachineStatus({ m }: { m: CompanyDetail["machines"][number] }) {
  if (!m.isActive) return <Badge>Switched off</Badge>;
  if (m.kind === "IMPORT") return <Badge>Upload</Badge>;
  if (!m.lastSeenAt) return <Badge tone="yellow">Not connected yet</Badge>;
  const mins = (Date.now() - new Date(m.lastSeenAt).getTime()) / 60000;
  if (m.kind === "ADMS" && mins < 10) return <Badge tone="green">Online</Badge>;
  return <Badge tone={m.kind === "ADMS" ? "red" : "gray"}>Last seen {formatRelative(m.lastSeenAt)}</Badge>;
}

function SwitchOffModal({ id, name, onClose, onDone }: { id: string; name: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal open onClose={onClose} title={`Switch ${name} off?`}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await supportApi("POST", `/support/companies/${id}/suspend`, { reason: reason.trim() });
            onDone();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not switch it off");
            setBusy(false);
          }
        }}
      >
        {error && <Alert>{error}</Alert>}
        <p className="text-sm text-slate-600">
          Everyone at {name} is signed out and can&apos;t sign in. No emails go out and their careers page is hidden. Nothing is deleted — switch it back on
          any time.
        </p>
        <Field label="Why?" hint="Recorded in the activity log and the company's history.">
          <Textarea required minLength={3} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Unpaid invoice INV-104" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={busy}>
            Switch off
          </Button>
        </div>
      </form>
    </Modal>
  );
}
