"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { publicApi } from "@/lib/api";
import { Alert, Button, Field, Input } from "@/components/ui";

export default function ResetPasswordPage() {
  // Read on the client so the page needs no server-side search params.
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token"));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError("The two passwords don't match");
    setSaving(true);
    setError(null);
    try {
      await publicApi("POST", "/auth/reset-password", { token, newPassword: password });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const heading = (
    <h1 className="text-2xl font-bold text-[#1a1a2e]" style={{ fontFamily: "var(--font-display)" }}>
      Choose a new password
    </h1>
  );

  if (token === undefined) return heading;
  if (!token) {
    return (
      <>
        {heading}
        <div className="mt-6 space-y-4">
          <Alert>This link is incomplete. Open the link from your email again, or ask for a new one.</Alert>
          <Link href="/forgot-password" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
            Send me a new link
          </Link>
        </div>
      </>
    );
  }
  if (done) {
    return (
      <>
        {heading}
        <div className="mt-6 space-y-6" role="status">
          <Alert tone="success">Your password has been changed.</Alert>
          <Link
            href="/login"
            className="flex w-full items-center justify-center rounded-xl bg-brand-600 px-3.5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Sign in
          </Link>
        </div>
      </>
    );
  }
  return (
    <>
      {heading}
      <p className="mt-1 text-sm text-gray-500">Use at least 8 characters.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {error && (
          <Alert>
            {error}{" "}
            {/expired|used/.test(error) && (
              <Link href="/forgot-password" className="font-semibold underline">
                Send a new link
              </Link>
            )}
          </Alert>
        )}
        <Field label="New password">
          <Input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Type it again">
          <Input type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <Button type="submit" loading={saving} className="w-full py-2.5">
          Save new password
        </Button>
      </form>
    </>
  );
}
