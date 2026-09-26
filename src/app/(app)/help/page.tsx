"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { formatRelative } from "@/lib/format";
import { LAST_PAGE_KEY } from "@/components/app-shell";
import { type HelpStatus, HelpStatusBadge } from "@/components/help";
import { Alert, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Spinner, Table, Td, Textarea, Th } from "@/components/ui";

interface HelpRequest {
  id: string;
  subject: string;
  status: HelpStatus;
  lastMessageAt: string;
  createdAt: string;
  lastMessage: { body: string; author: string; fromSupport: boolean } | null;
}

// "Get help": questions to the Quscer team and their answers.
export default function HelpPage() {
  const list = useApi<HelpRequest[]>("/help/tickets");
  const [asking, setAsking] = useState(false);
  const router = useRouter();

  return (
    <>
      <PageHeader
        title="Get help"
        description="Ask the Quscer team anything about Quscer People. We reply here and by email."
        actions={<Button onClick={() => setAsking(true)}>New question</Button>}
      />
      {list.error && <Alert>{list.error}</Alert>}
      {list.loading && !list.data ? (
        <Spinner />
      ) : (
        <Card padded={false}>
          {!list.data?.length ? (
            <EmptyState
              title="No questions yet"
              description="Stuck on something, or something doesn't look right? Ask us — it goes straight to the Quscer support team."
              action={<Button onClick={() => setAsking(true)}>Ask a question</Button>}
            />
          ) : (
            <Table>
              <thead className="bg-slate-50">
                <tr>
                  <Th>Question</Th>
                  <Th>Last message</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.data.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <Td className="max-w-md whitespace-normal">
                      <Link href={`/help/${t.id}`} className="font-medium text-slate-900 hover:text-[#00857a] hover:underline">
                        {t.subject}
                      </Link>
                      {t.lastMessage && (
                        <p className="truncate text-xs text-slate-500">
                          {t.lastMessage.fromSupport ? `${t.lastMessage.author} (Quscer)` : "You"}: {t.lastMessage.body}
                        </p>
                      )}
                    </Td>
                    <Td>{formatRelative(t.lastMessageAt)}</Td>
                    <Td>
                      <HelpStatusBadge status={t.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}
      {asking && <AskModal onClose={() => setAsking(false)} onSent={(id) => router.push(`/help/${id}`)} />}
    </>
  );
}

function AskModal({ onClose, onSent }: { onClose: () => void; onSent: (id: string) => void }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal open onClose={onClose} title="Ask Quscer support">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          let page: string | undefined;
          try {
            page = window.sessionStorage.getItem(LAST_PAGE_KEY) ?? undefined;
          } catch {
            page = undefined;
          }
          try {
            const t = await api<{ id: string }>("POST", "/help/tickets", { subject: subject.trim(), body: body.trim(), page });
            onSent(t.id);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not send");
            setBusy(false);
          }
        }}
      >
        {error && <Alert>{error}</Alert>}
        <Field label="What's it about?">
          <Input required minLength={3} maxLength={150} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Can't add a second branch" />
        </Field>
        <Field label="Tell us more" hint="What were you trying to do, and what happened? The more detail, the faster we can help.">
          <Textarea required minLength={5} rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <p className="text-xs text-slate-500">
          To help you, Quscer support may look at your account as you see it, read-only. Every look is recorded.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Send
          </Button>
        </div>
      </form>
    </Modal>
  );
}
