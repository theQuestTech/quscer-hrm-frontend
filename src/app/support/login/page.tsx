"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supportApi, useSupport } from "@/lib/support";
import { SupportAuthFrame } from "@/components/support-auth-frame";
import { Alert, Button, Field, Input } from "@/components/ui";
import { CodeInput } from "@/components/two-step";

export default function SupportLoginPage() {
  const { agent, login, loginWithCode } = useSupport();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState<"form" | "sent" | null>(null);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);

  async function sendCode() {
    if (!challenge) return;
    setBusy(true);
    setError(null);
    try {
      await loginWithCode(challenge, useBackup ? { backupCode: code } : { code });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not sign in";
      setError(message);
      setCode("");
      // The sign-in expired or had too many tries: back to the password.
      if (/password again/.test(message)) setChallenge(null);
      setBusy(false);
    }
  }

  useEffect(() => {
    if (agent) router.replace("/support");
  }, [agent, router]);

  if (forgot) {
    return (
      <SupportAuthFrame>
        <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          Set or reset your password
        </h1>
        {forgot === "sent" ? (
          <div className="mt-6 space-y-4" role="status">
            <Alert tone="success">If {email} is on the support team, a link is on its way. It works once and expires in an hour.</Alert>
            <Button variant="secondary" onClick={() => setForgot(null)}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              try {
                await supportApi("POST", "/support/auth/forgot-password", { email });
                setForgot("sent");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Something went wrong");
              } finally {
                setBusy(false);
              }
            }}
          >
            {error && <Alert>{error}</Alert>}
            <p className="text-sm text-slate-500">First time here, or forgot it? We&apos;ll email you a link to choose one.</p>
            <Field label="Work email">
              <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" loading={busy}>
                Email me a link
              </Button>
              <Button type="button" variant="ghost" onClick={() => setForgot(null)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </SupportAuthFrame>
    );
  }

  if (challenge) {
    return (
      <SupportAuthFrame>
        <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          Enter your code
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {useBackup ? "Type one of your backup codes. Each works once." : "Open your authenticator app and type the 6-digit code for Quscer HRM Support."}
        </p>
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            sendCode();
          }}
        >
          {error && <Alert>{error}</Alert>}
          {useBackup ? (
            <Field label="Backup code">
              <Input autoFocus required placeholder="XXXX-XXXX" className="font-mono tracking-wider" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            </Field>
          ) : (
            <CodeInput value={code} onChange={setCode} autoFocus onEnter={sendCode} />
          )}
          <Button type="submit" loading={busy} disabled={useBackup ? code.trim().length < 8 : code.length !== 6} className="w-full">
            Sign in
          </Button>
          <div className="flex justify-between text-sm">
            <button
              type="button"
              className="font-medium text-[#00857a] hover:underline"
              onClick={() => {
                setUseBackup(!useBackup);
                setCode("");
                setError(null);
              }}
            >
              {useBackup ? "Use the app instead" : "Lost your phone? Use a backup code"}
            </button>
            <button
              type="button"
              className="text-slate-500 hover:underline"
              onClick={() => {
                setChallenge(null);
                setCode("");
                setPassword("");
                setError(null);
              }}
            >
              Start again
            </button>
          </div>
          {useBackup && <p className="text-xs text-slate-500">No backup codes left? Ask the support owner to reset your two-step sign-in.</p>}
        </form>
      </SupportAuthFrame>
    );
  }

  return (
    <SupportAuthFrame>
      <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Sign in
      </h1>
      <form
        className="mt-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const next = await login(email, password);
            if (next) {
              setChallenge(next.challengeToken);
              setBusy(false);
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not sign in");
            setBusy(false);
          }
        }}
      >
        {error && <Alert>{error}</Alert>}
        <Field label="Work email">
          <Input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <Input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" loading={busy} className="w-full">
          Sign in
        </Button>
        <button type="button" onClick={() => setForgot("form")} className="block w-full text-center text-sm font-medium text-[#00857a] hover:underline">
          First time, or forgot your password?
        </button>
      </form>
    </SupportAuthFrame>
  );
}
