"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { type TicketDetail, supportApi, useSupportApi } from "@/lib/support";
import { formatRelative } from "@/lib/format";
import { Conversation } from "@/components/help";
import { TicketBadge, ViewAsModal } from "@/components/support";
import { Alert, Button, Card, PageHeader, Spinner, Textarea } from "@/components/ui";

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const ticket = useSupportApi<TicketDetail>(`/support/tickets/${id}`);
  const [reply, setReply] = useState("");
  const [close, setClose] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);

  if (ticket.loading && !ticket.data) return <Spinner />;
  if (ticket.error) return <Alert>{ticket.error}</Alert>;
  const t = ticket.data;
  if (!t) return null;

  async function run(key: string, task: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await task();
      await ticket.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const who = `${t.user.firstName} ${t.user.lastName}`;
  return (
    <>
      <Link href="/support/tickets" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="size-4" /> Help requests
      </Link>
      <PageHeader
        title={t.subject}
        description={`${who} (${t.user.roles.join(", ") || "no role"}) · ${t.user.email} · asked ${formatRelative(t.createdAt)}${t.page ? ` · was on ${t.page}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <TicketBadge status={t.status} />
            <Link href={`/support/companies/${t.organization.id}`} className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50">
              {t.organization.name}
            </Link>
            <Button variant="secondary" onClick={() => setViewing(true)}>
              View as {t.user.firstName}
            </Button>
            {t.status === "CLOSED" ? (
              <Button variant="secondary" loading={busy === "open"} onClick={() => run("open", () => supportApi("POST", `/support/tickets/${id}/status`, { status: "OPEN" }))}>
                Reopen
              </Button>
            ) : (
              <Button variant="secondary" loading={busy === "close"} onClick={() => run("close", () => supportApi("POST", `/support/tickets/${id}/status`, { status: "CLOSED" }))}>
                Close
              </Button>
            )}
          </div>
        }
      />
      <Card padded={false}>
        <Conversation messages={t.messages} mine="support" />
        <form
          className="border-t border-gray-100 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!reply.trim()) return;
            run("send", async () => {
              await supportApi("POST", `/support/tickets/${id}/messages`, { body: reply.trim(), close });
              setReply("");
            });
          }}
        >
          {error && (
            <div className="mb-3">
              <Alert>{error}</Alert>
            </div>
          )}
          <label htmlFor="reply" className="sr-only">
            Reply
          </label>
          <Textarea
            id="reply"
            rows={5}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={`Write a reply… ${t.user.firstName} gets it by email and in HRM.`}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={close} onChange={(e) => setClose(e.target.checked)} className="size-4 rounded border-slate-300" />
              Close after sending (they can still reply to reopen it)
            </label>
            <Button type="submit" loading={busy === "send"} disabled={!reply.trim()}>
              Send reply
            </Button>
          </div>
        </form>
      </Card>
      {viewing && (
        <ViewAsModal
          organizationId={t.organization.id}
          people={[t.user]}
          initialReason={`Ticket: ${t.subject}`.slice(0, 300)}
          onClose={() => setViewing(false)}
        />
      )}
    </>
  );
}
