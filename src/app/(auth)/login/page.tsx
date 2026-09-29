"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Alert, Button, Field, Input } from "@/components/ui";
import { CodeInput } from "@/components/two-step";

export default function LoginPage() {
  const { login, loginWithCode, me, loading, setupRequired } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Two-step sign-in: after the password, the 6-digit code (or a backup code).
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [backupCode, setBackupCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(true);

  useEffect(() => {
    if (!loading && me) router.replace(setupRequired ? "/two-step-setup" : "/");
  }, [loading, me, setupRequired, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const next = await login(email, password);
      if (next) {
        setChallenge(next.challengeToken);
        setCode("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (!challenge) return;
    setError(null);
    setSubmitting(true);
    try {
      await loginWithCode(email, challenge, useBackup ? { backupCode, trustDevice } : { code, trustDevice });
    } catch (err) {
      const text = err instanceof Error ? err.message : "Sign in failed";
      setError(text);
      setCode("");
      // Too many tries or took too long — back to the password.
      if (/password again/.test(text)) setChallenge(null);
    } finally {
      setSubmitting(false);
    }
  }

  if (challenge) {
    return (
      <>
        <h1 className="text-2xl font-bold text-[#1a1a2e]" style={{ fontFamily: "var(--font-display)" }}>
          {useBackup ? "Use a backup code" : "Enter your code"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {useBackup ? "Type one of the backup codes you saved when you turned on two-step sign-in." : "Open your authenticator app and type the 6-digit code for Quscer HRM."}
        </p>
        <form onSubmit={submitCode} className="mt-8 space-y-4">
          {error && <Alert>{error}</Alert>}
          {useBackup ? (
            <Input value={backupCode} onChange={(e) => setBackupCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX" autoFocus aria-label="Backup code" className="text-center font-mono text-lg tracking-widest" />
          ) : (
            <CodeInput value={code} onChange={setCode} autoFocus onEnter={submitCode} />
          )}
          <label className="flex items-center justify-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={trustDevice} onChange={(e) => setTrustDevice(e.target.checked)} className="accent-brand-600" />
            Trust this computer for 30 days
          </label>
          <Button type="submit" loading={submitting} disabled={useBackup ? !backupCode.trim() : code.length !== 6} className="w-full py-2.5">
            Sign in
          </Button>
        </form>
        <p className="mt-6 space-x-3 text-center text-sm">
          <button type="button" className="font-medium text-brand-600 hover:text-brand-700" onClick={() => setUseBackup((v) => !v)}>
            {useBackup ? "Use the app code instead" : "Lost your phone? Use a backup code"}
          </button>
          <span className="text-gray-300">·</span>
          <button type="button" className="font-medium text-gray-500" onClick={() => setChallenge(null)}>
            Back
          </button>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-[#1a1a2e]" style={{ fontFamily: "var(--font-display)" }}>
        Welcome back
      </h1>
      <p className="mt-1 text-sm text-gray-500">Sign in with your work email.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Email">
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="-mt-1 text-right">
          <Link href="/forgot-password" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" loading={submitting} className="w-full py-2.5">
          Sign in
        </Button>
      </form>
      <p className="mt-8 border-t border-gray-100 pt-6 text-center text-sm text-gray-500">
        New company?{" "}
        <Link href="/signup" className="font-semibold text-brand-600 hover:text-brand-700">
          Create an account
        </Link>
      </p>
    </>
  );
}
