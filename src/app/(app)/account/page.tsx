"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Alert, Button, Card, Field, Input, PageHeader } from "@/components/ui";

export default function AccountPage() {
  const { me } = useAuth();
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
      <PageHeader title="My account" description={me?.user.email} />
      <Card title="Change password" className="max-w-lg">
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
    </>
  );
}
