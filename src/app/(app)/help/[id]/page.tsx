"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { formatDate } from "@/lib/format";
import { Conversation, type HelpStatus, HelpStatusBadge } from "@/components/help";
import { Alert, Button, Card, PageHeader, Spinner, Textarea } from "@/components/ui";

interface HelpThread {
  id: string;
  subject: string;
  status: HelpStatus;
  createdAt: string;
  messages: { id: string; body: string; createdAt: string; fromSupport: boolean; author: string }[];
}

export default function HelpThreadPage() {
  const { id } = useParams<{ id: string }>();
  const thread = useApi<HelpThread>(`/help/tickets/${id}`);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState<"send" | "close" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (thread.loading && !thread.data) return <Spinner />;
  if (thread.error) return <Alert>{thread.error}</Alert>;
  const t = thread.data;
  if (!t) return null;

  async function act(kind: "send" | "close") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "send") {
        await api("POST", `/help/tickets/${id}/messages`, { body: reply.trim() });
        setReply("");
      } else {
        await api("POST", `/help/tickets/${id}/close`);
      }
      await thread.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Link href="/help" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="size-4" /> Get help
      </Link>
      <PageHeader
        title={t.subject}
        description={`Asked ${formatDate(t.createdAt)}`}
        actions={
          <div className="flex items-center gap-2">
            <HelpStatusBadge status={t.status} />
            {t.status !== "CLOSED" && (
              <Button variant="secondary" size="sm" loading={busy === "close"} onClick={() => act("close")}>
                Mark as solved
              </Button>
            )}
          </div>
        }
      />
      <Card padded={false}>
        <Conversation messages={t.messages} mine="customer" />
        <form
          className="border-t border-gray-100 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (reply.trim()) act("send");
          }}
        >
          {error && (
            <div className="mb-3">
              <Alert>{error}</Alert>
            </div>
          )}
          <label htmlFor="reply" className="sr-only">
            Your reply
          </label>
          <Textarea
            id="reply"
            rows={4}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={t.status === "CLOSED" ? "Still need help? Write here to reopen it." : "Write a reply…"}
          />
          <div className="mt-3 flex justify-end">
            <Button type="submit" loading={busy === "send"} disabled={!reply.trim()}>
              Send reply
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
