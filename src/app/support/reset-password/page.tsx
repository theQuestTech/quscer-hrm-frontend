"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supportApi } from "@/lib/support";
import { SupportAuthFrame } from "@/components/support-auth-frame";
import { Alert, Button, Field, Input } from "@/components/ui";

export default function SupportResetPasswordPage() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token"));
  }, []);

  return (
    <SupportAuthFrame>
      <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Choose your password
      </h1>
      {token === undefined ? null : !token ? (
        <div className="mt-6">
          <Alert>This link is incomplete. Open the link from your email again.</Alert>
        </div>
      ) : done ? (
        <div className="mt-6 space-y-4" role="status">
          <Alert tone="success">Your password is set.</Alert>
          <Link href="/support/login" className="inline-flex rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Sign in
          </Link>
        </div>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (password !== confirm) return setError("The two passwords don't match");
            setBusy(true);
            setError(null);
            try {
              await supportApi("POST", "/support/auth/reset-password", { token, newPassword: password });
              setDone(true);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Something went wrong");
            } finally {
              setBusy(false);
            }
          }}
        >
          {error && <Alert>{error}</Alert>}
          <p className="text-sm text-slate-500">Support staff can see every company, so use at least 12 characters.</p>
          <Field label="New password">
            <Input type="password" required minLength={12} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Type it again">
            <Input type="password" required minLength={12} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <Button type="submit" loading={busy}>
            Save password
          </Button>
        </form>
      )}
    </SupportAuthFrame>
  );
}
