"use client";

import Link from "next/link";
import { useState } from "react";
import { publicApi } from "@/lib/api";
import { Alert, Button, Field, Input } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ emailEnabled: boolean } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      setResult(await publicApi<{ ok: true; emailEnabled: boolean }>("POST", "/auth/forgot-password", { email: email.trim() }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-[#1a1a2e]" style={{ fontFamily: "var(--font-display)" }}>
        Forgot your password?
      </h1>
      {result ? (
        result.emailEnabled ? (
          <div className="mt-6 space-y-4" role="status">
            <Alert tone="success">If {email.trim()} has an account, we&apos;ve sent it a link to choose a new password.</Alert>
            <p className="text-sm text-gray-500">
              The link works once and expires in 1 hour. Can&apos;t find it? Check your spam folder, or try again in a few minutes.
            </p>
          </div>
        ) : (
          <div className="mt-6" role="status">
            <Alert tone="info">Password reset by email isn&apos;t set up yet. Please ask your HR admin to reset your password.</Alert>
          </div>
        )
      ) : (
        <>
          <p className="mt-1 text-sm text-gray-500">Enter your work email and we&apos;ll send you a link to choose a new one.</p>
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {error && <Alert>{error}</Alert>}
            <Field label="Email">
              <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Button type="submit" loading={sending} className="w-full py-2.5">
              Send reset link
            </Button>
          </form>
        </>
      )}
      <p className="mt-8 border-t border-gray-100 pt-6 text-center text-sm text-gray-500">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
