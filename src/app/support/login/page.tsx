"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supportApi, useSupport } from "@/lib/support";
import { SupportAuthFrame } from "@/components/support-auth-frame";
import { Alert, Button, Field, Input } from "@/components/ui";

export default function SupportLoginPage() {
  const { agent, login } = useSupport();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState<"form" | "sent" | null>(null);

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
            await login(email, password);
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
