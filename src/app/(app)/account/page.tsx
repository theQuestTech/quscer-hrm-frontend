"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Alert, Badge, Button, Card, Field, Input, Modal, PageHeader } from "@/components/ui";

// My Account: how you sign in. Your company list shows for HR admins (who
// can add companies) and anyone who belongs to more than one company.
export default function AccountPage() {
  const { me, can } = useAuth();
  const showCompanies = !!me && (can("hrm.settings.write") || me.companies.length > 1);
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (form.newPassword !== form.confirm) {
      setMessage({ tone: "error", text: "The new passwords don't match" });
      return;
    }
    setSaving(true);
    try {
      await api("POST", "/auth/change-password", {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
      setMessage({ tone: "success", text: "Password changed. Use the new one next time you sign in." });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Could not change password" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="My Account" description={`Signed in as ${me?.user.email ?? ""}`} />
      <div className="grid gap-6 lg:grid-cols-2">
      {showCompanies && <Companies />}
      <Card title="Change password">
        <form onSubmit={submit} className="space-y-4">
          {message && <Alert tone={message.tone}>{message.text}</Alert>}
          <Field label="Current password">
            <Input
              type="password"
              required
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            />
          </Field>
          <Field label="New password" hint="At least 8 characters">
            <Input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            />
          </Field>
          <Field label="Confirm new password">
            <Input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            />
          </Field>
          <Button type="submit" loading={saving}>
            Change password
          </Button>
        </form>
      </Card>
      </div>
    </>
  );
}

// One login can work in several companies — e.g. an outsourced HR firm
// looking after its clients. Other companies add you from their Settings →
// Users; "Add a company" sets up a brand-new one with you as HR Admin.
function Companies() {
  const { me, can, switchCompany, addCompany } = useAuth();
  const canAdd = can("hrm.settings.write");
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!me) return null;

  async function open(id: string) {
    setBusy(id);
    setError(null);
    try {
      await switchCompany(id);
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open that company");
    } finally {
      setBusy(null);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy("new");
    setError(null);
    try {
      await addCompany(name.trim());
      router.push("/settings?welcome=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the company");
      setBusy(null);
    }
  }

  return (
    <Card
      title="My companies"
      padded={false}
      actions={
        canAdd && (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add a company
          </Button>
        )
      }
    >
      {error && !adding && (
        <div className="p-4">
          <Alert>{error}</Alert>
        </div>
      )}
      <ul className="divide-y divide-slate-100">
        {me.companies.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
            <span className="flex items-center gap-2 font-medium text-slate-900">
              <Building2 className="size-4 text-slate-400" aria-hidden /> {c.name}
            </span>
            {c.id === me.organization.id ? (
              <Badge tone="blue">Open now</Badge>
            ) : (
              <Button size="sm" variant="secondary" loading={busy === c.id} onClick={() => open(c.id)}>
                Open
              </Button>
            )}
          </li>
        ))}
      </ul>
      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
        Working for another company too? Ask them to add your email ({me.user.email}) in their Settings → Users — you&apos;ll
        keep this same login and password.
      </p>
      <Modal open={adding} onClose={() => setAdding(false)} title="Add a company">
        <form onSubmit={create} className="space-y-4">
          <p className="text-sm text-slate-600">
            For example a client you do HR for, or another company in your group. You&apos;ll be its HR Admin and can switch
            between companies from the menu.
          </p>
          {error && <Alert>{error}</Alert>}
          <Field label="Company name">
            <Input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy === "new"}>
              Create company
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
