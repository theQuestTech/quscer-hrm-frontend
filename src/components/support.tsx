"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { type Overview, type EmailStatus, type SupportActivity, type TicketStatus, supportApi, useSupport, useSupportApi } from "@/lib/support";
import { Alert, Badge, type BadgeTone, Button, Field, Input, Modal, Select, Spinner, cx } from "./ui";

// --- Words ---------------------------------------------------------------------------------

const TICKET: Record<TicketStatus, [BadgeTone, string]> = {
  OPEN: ["yellow", "Waiting for us"],
  ANSWERED: ["blue", "Waiting for them"],
  CLOSED: ["gray", "Closed"],
};

export function TicketBadge({ status }: { status: TicketStatus }) {
  const [tone, label] = TICKET[status];
  return <Badge tone={tone}>{label}</Badge>;
}

const EMAIL: Record<EmailStatus, [BadgeTone, string]> = {
  SENT: ["gray", "Sent"],
  DELIVERED: ["green", "Delivered"],
  FAILED: ["red", "Failed"],
  BOUNCED: ["red", "Bounced"],
  COMPLAINED: ["red", "Marked as spam"],
};

export function EmailBadge({ status }: { status: EmailStatus }) {
  const [tone, label] = EMAIL[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export const EMAIL_KIND: Record<string, string> = {
  welcome: "Welcome",
  password_reset: "Password reset",
  leave_requested: "Leave request",
  leave_first_approved: "Leave — final approval",
  leave_decided: "Leave decision",
  payslip_ready: "Payslip ready",
  training_booked: "Training booked",
  candidate_applied: "New application",
  expiry_reminder: "Expiry reminder",
  expiry_summary: "Expiry summary (HR)",
  support_reply: "Support reply",
  support_ticket_to_team: "Help request (to us)",
};

// "Ali sent a password reset link to sara@…" — what support did, in words.
export function activityText(a: SupportActivity): string {
  const d = a.detail as Record<string, string | boolean | undefined>;
  switch (a.action) {
    case "company.suspended":
      return `switched the company off — “${d.reason}”`;
    case "company.resumed":
      return "switched the company back on";
    case "user.reset_link_sent":
      return `sent a password reset link to ${d.email}`;
    case "user.welcome_resent":
      return `resent the welcome email to ${d.email}`;
    case "user.viewed":
      return `viewed HRM as ${d.email} (read-only) — “${d.reason}”`;
    case "ticket.replied":
      return `replied to “${d.subject}”${d.closed ? " and closed it" : ""}`;
    case "ticket.open":
      return `reopened “${d.subject}”`;
    case "ticket.answered":
      return `marked “${d.subject}” as waiting for them`;
    case "ticket.closed":
      return `closed “${d.subject}”`;
    case "agent.added":
      return `added ${d.name} (${d.email}) to the support team`;
    case "agent.switched_off":
      return `switched off ${d.email}'s support account`;
    case "agent.switched_on":
      return `switched ${d.email}'s support account back on`;
    case "agent.password_set":
      return "set their password";
    default:
      return a.action;
  }
}

// --- Layout ------------------------------------------------------------------------------------

const NAV = [
  { href: "/support", label: "Companies", exact: true },
  { href: "/support/tickets", label: "Help requests", count: true },
  { href: "/support/activity", label: "Activity log" },
  { href: "/support/team", label: "Support team" },
];

export function SupportShell({ children }: { children: React.ReactNode }) {
  const { agent, loading, logout } = useSupport();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  // Refreshed on every page change so the "waiting" number stays current.
  const [openCount, setOpenCount] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && !agent) router.replace("/support/login");
  }, [loading, agent, router]);

  useEffect(() => {
    setMenuOpen(false);
    if (!agent) return;
    supportApi<Overview>("GET", "/support/overview")
      .then((o) => setOpenCount(o.openTickets))
      .catch(() => undefined);
  }, [pathname, agent]);

  if (loading || !agent) return <Spinner />;

  const active = (href: string, exact?: boolean) =>
    exact ? pathname === href || pathname.startsWith("/support/companies") : pathname.startsWith(href);

  const sidebar = (
    <div className="flex h-full flex-col px-3.5 py-5 text-slate-300">
      <div className="flex items-center gap-2.5 px-2 pb-6">
        <span className="grid size-9 place-items-center rounded-xl bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/quscer-mark.png" alt="" className="size-6" />
        </span>
        <span>
          <span className="block text-base font-bold leading-tight text-white" style={{ fontFamily: "var(--font-display)" }}>
            Quscer
          </span>
          <span className="block text-xs font-semibold text-[#34d3c4]">Support console</span>
        </span>
      </div>
      <nav aria-label="Support" className="space-y-1">
        {NAV.map((n) => {
          const on = active(n.href, n.exact);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={on ? "page" : undefined}
              className={cx(
                "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm",
                on ? "bg-[#34d3c4]/15 font-semibold text-white" : "hover:bg-white/5 hover:text-white",
              )}
            >
              {n.label}
              {n.count && !!openCount && (
                <span className="rounded-full bg-amber-400 px-2 text-xs font-bold text-[#10222a]" aria-label={`${openCount} waiting`}>
                  {openCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-white/10 px-2 pt-4 text-xs">
        <p className="text-sm font-semibold text-white">{agent.name}</p>
        <p className="truncate">{agent.email}</p>
        <button type="button" onClick={logout} className="mt-3 text-[#34d3c4] hover:underline">
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#f6f8fa] text-[#1a1a2e]">
      <aside className="fixed inset-y-0 left-0 hidden w-60 bg-[#10222a] lg:block">{sidebar}</aside>
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMenuOpen(false)} />
          <aside className="relative h-full w-64 max-w-[85%] bg-[#10222a]">{sidebar}</aside>
        </div>
      )}
      <div className="min-w-0 flex-1 lg:pl-60">
        <div className="flex items-center gap-3 bg-[#10222a] px-4 py-3 text-white lg:hidden">
          <button type="button" onClick={() => setMenuOpen(true)} className="rounded-lg px-2 py-1 text-sm ring-1 ring-white/20" aria-label="Open menu">
            Menu
          </button>
          <span className="text-sm font-semibold">Quscer support</span>
        </div>
        <main className="p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}

// --- View as a user -----------------------------------------------------------------------------

// Starts a read-only, 30-minute look at HRM as someone, in a new tab.
export function ViewAsModal({
  organizationId,
  people,
  initialUserId,
  initialReason = "",
  onClose,
  onStarted,
}: {
  organizationId: string;
  people: { id: string; firstName: string; lastName: string; email: string }[];
  initialUserId?: string;
  initialReason?: string;
  onClose: () => void;
  onStarted?: () => void;
}) {
  const [userId, setUserId] = useState(initialUserId ?? people[0]?.id ?? "");
  const [reason, setReason] = useState(initialReason);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const person = people.find((p) => p.id === userId);
  return (
    <Modal open onClose={onClose} title={person ? `View HRM as ${person.firstName} ${person.lastName}` : "View HRM as a user"}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          // Open the tab now (in the click) so pop-up blockers allow it.
          const tab = window.open("about:blank", "_blank");
          try {
            const v = await supportApi<{ token: string }>("POST", `/support/users/${userId}/view`, { organizationId, reason: reason.trim() });
            const url = `${window.location.origin}/support-view#t=${encodeURIComponent(v.token)}`;
            if (tab) {
              tab.opener = null;
              tab.location.href = url;
            } else {
              window.open(url, "_blank", "noopener");
            }
            onStarted?.();
            onClose();
          } catch (err) {
            tab?.close();
            setError(err instanceof Error ? err.message : "Could not start the view");
            setBusy(false);
          }
        }}
      >
        {error && <Alert>{error}</Alert>}
        <Alert tone="info">
          You&apos;ll see exactly what they see, <strong>read-only</strong> — nothing can be saved, approved or sent. The view ends by itself after{" "}
          <strong>30 minutes</strong>. It&apos;s recorded here and in the company&apos;s own history.
        </Alert>
        {people.length > 1 && (
          <Field label="Person">
            <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName} ({p.email})
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Why do you need to look?">
          <Input required minLength={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Ticket: payslip page is empty" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={!userId}>
            Open read-only view
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function useOverview() {
  return useSupportApi<Overview>("/support/overview");
}
