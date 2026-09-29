"use client";

import { useEffect, useState } from "react";
import { Download, Printer, ShieldCheck, Smartphone } from "lucide-react";
import { api } from "@/lib/api";
import { forgetTrustedTokens, setCodeAsker, askCode } from "@/lib/two-step";
import { Alert, Badge, Button, Card, Modal, Spinner } from "@/components/ui";

// One box for the 6-digit code: big spaced digits, numbers only.
export function CodeInput({ value, onChange, onEnter, autoFocus }: { value: string; onChange: (v: string) => void; onEnter?: () => void; autoFocus?: boolean }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      onKeyDown={(e) => e.key === "Enter" && value.length === 6 && onEnter?.()}
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus={autoFocus}
      placeholder="000000"
      aria-label="6-digit code"
      className="block w-full rounded-xl border-0 bg-white py-3 pl-[0.5em] text-center font-mono text-2xl tracking-[0.5em] text-slate-900 ring-1 ring-inset ring-gray-200 placeholder:text-slate-300 focus:ring-2 focus:ring-inset focus:ring-brand-600"
    />
  );
}

// "Confirm it's you" — opens whenever the server asks for a code before a
// sensitive action (approving payroll, bank details, the bank file…).
export function CodePrompt() {
  const [state, setState] = useState<{ message: string; error: string | null; resolve: (c: string | null) => void } | null>(null);
  const [code, setCode] = useState("");
  useEffect(() => {
    setCodeAsker(
      (message, error) =>
        new Promise((resolve) => {
          setCode("");
          setState({ message, error, resolve });
        }),
    );
    return () => setCodeAsker(null);
  }, []);
  const answer = (c: string | null) => {
    state?.resolve(c);
    setState(null);
  };
  return (
    <Modal open={!!state} onClose={() => answer(null)} title="Confirm it’s you">
      <p className="mb-3 text-sm text-slate-600">{state?.message}</p>
      <CodeInput value={code} onChange={setCode} autoFocus onEnter={() => answer(code)} />
      {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      <div className="mt-4 flex gap-2">
        <Button className="flex-1" disabled={code.length !== 6} onClick={() => answer(code)}>
          Confirm
        </Button>
        <Button variant="secondary" onClick={() => answer(null)}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}

interface Setup {
  secret: string;
  qrDataUrl: string;
}

// Turning two-step on: scan the QR code, type the code, keep the backup codes.
export function TwoStepSetup({ onDone, compact }: { onDone: (accessToken: string) => void; compact?: boolean }) {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ backupCodes: string[]; accessToken: string } | null>(null);
  useEffect(() => {
    api<Setup>("POST", "/auth/two-step/setup")
      .then(setSetup)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not start"));
  }, []);
  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      setResult(await api<{ backupCodes: string[]; accessToken: string }>("POST", "/auth/two-step/confirm", { code }));
    } catch (e) {
      setCode("");
      setError(e instanceof Error ? e.message : "That code isn't right");
    } finally {
      setBusy(false);
    }
  }
  if (result) return <BackupCodes codes={result.backupCodes} doneLabel="I’ve saved them — continue" onDone={() => onDone(result.accessToken)} />;
  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
      <div className={compact ? "flex flex-col gap-5" : "flex flex-col gap-5 sm:flex-row"}>
        <div className={compact ? "shrink-0 self-center" : "shrink-0 self-center sm:self-start"}>
          {setup ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={setup.qrDataUrl} alt="QR code to scan with your authenticator app" className="size-44 rounded-lg ring-1 ring-slate-200" />
          ) : (
            <div className="size-44 animate-pulse rounded-lg bg-slate-100" />
          )}
        </div>
        <ol className="min-w-0 flex-1 list-decimal space-y-3 pl-5 text-sm text-slate-700">
          <li>
            Install <b>Google Authenticator</b> or <b>Microsoft Authenticator</b> on your phone (free).
          </li>
          <li>
            In the app, tap <b>+</b> and scan this QR code.
            {setup && (
              <div className="mt-1 text-xs text-slate-500">
                Can’t scan? Type this key: <span className="break-all font-mono text-brand-700">{setup.secret}</span>
              </div>
            )}
          </li>
          <li>
            Type the 6-digit code the app shows:
            <div className="mt-2 max-w-[260px]">
              <CodeInput value={code} onChange={setCode} onEnter={confirm} />
            </div>
          </li>
          <li className="-ml-5 list-none">
            <Button onClick={confirm} loading={busy} disabled={code.length !== 6 || !setup}>
              <Smartphone className="size-4" /> Turn on
            </Button>
          </li>
        </ol>
      </div>
      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}
    </div>
  );
}

// Backup codes, shown once. Each works once if the phone is lost.
export function BackupCodes({ codes, onDone, doneLabel }: { codes: string[]; onDone: () => void; doneLabel: string }) {
  const text = `Quscer HRM backup codes — each works once if you lose your phone.\n\n${codes.join("\n")}\n`;
  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "quscer-hrm-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }
  function print() {
    const w = window.open("", "_blank", "width=420,height=560");
    if (!w) return;
    w.document.write(`<pre style="font:16px monospace;padding:24px">${text.replace(/</g, "&lt;")}</pre>`);
    w.document.close();
    w.print();
  }
  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
      <h3 className="text-base font-semibold text-slate-900">Save your backup codes</h3>
      <p className="mb-3 mt-1 text-sm text-slate-500">If you lose your phone, each of these works once instead of a code. They’re shown only now — print them or keep them somewhere safe.</p>
      <div className="mb-4 grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-5">
        {codes.map((c) => (
          <span key={c} className="rounded-md bg-slate-50 py-1.5 text-center ring-1 ring-slate-200">
            {c}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={download}>
          <Download className="size-4" /> Download
        </Button>
        <Button variant="secondary" onClick={print}>
          <Printer className="size-4" /> Print
        </Button>
        <Button onClick={onDone}>{doneLabel}</Button>
      </div>
    </div>
  );
}

interface Status {
  enabled: boolean;
  enabledAt: string | null;
  required: boolean;
  backupCodesLeft: number;
  trustedDevices: number;
}

// My Account › Two-step sign-in.
export function MyTwoStepCard({ onToken }: { onToken: (accessToken: string) => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [settingUp, setSettingUp] = useState(false);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const load = () => api<Status>("GET", "/auth/two-step").then(setStatus).catch(() => undefined);
  useEffect(() => {
    load();
  }, []);

  // These endpoints take the code in the body, so ask here.
  async function withCode(run: (code: string) => Promise<void>) {
    let error: string | null = null;
    for (let i = 0; i < 3; i++) {
      const code = await askCode("Type the 6-digit code from your authenticator app to confirm.", error);
      if (!code) return;
      try {
        await run(code);
        return;
      } catch (e) {
        error = e instanceof Error ? e.message : "That code isn't right";
      }
    }
    if (error) setMessage({ tone: "error", text: error });
  }

  if (!status) return <Spinner />;
  if (newCodes) return <BackupCodes codes={newCodes} doneLabel="Done" onDone={() => setNewCodes(null)} />;
  if (!status.enabled && settingUp)
    return (
      <TwoStepSetup
        onDone={(token) => {
          onToken(token);
          setSettingUp(false);
          setMessage({ tone: "success", text: "Two-step sign-in is on." });
          load();
        }}
      />
    );

  return (
    <Card
      title="Two-step sign-in"
      actions={status.enabled ? <Badge tone="green">On</Badge> : <Badge tone="red">Off</Badge>}
    >
      {message && (
        <div className="mb-3">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}
      {!status.enabled ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">After your password, you also type a 6-digit code from an app on your phone. A stolen password alone can’t get in.</p>
          <Button onClick={() => setSettingUp(true)}>
            <ShieldCheck className="size-4" /> Turn on
          </Button>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <p className="text-slate-600">
            On since {status.enabledAt ? new Date(status.enabledAt).toLocaleDateString() : "—"}
            {status.required && " · required for your role"}.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-3.5 ring-1 ring-slate-200">
              <div className="font-medium text-slate-900">Backup codes</div>
              <div className={`mb-2.5 text-xs ${status.backupCodesLeft <= 2 ? "text-red-600" : "text-slate-500"}`}>{status.backupCodesLeft} of 10 left</div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  withCode(async (code) => {
                    const r = await api<{ backupCodes: string[] }>("POST", "/auth/two-step/backup-codes", { code });
                    setNewCodes(r.backupCodes);
                    load();
                  })
                }
              >
                Make new codes
              </Button>
            </div>
            <div className="rounded-lg bg-slate-50 p-3.5 ring-1 ring-slate-200">
              <div className="font-medium text-slate-900">Trusted computers</div>
              <div className="mb-2.5 text-xs text-slate-500">{status.trustedDevices} skip the code for 30 days</div>
              <Button
                size="sm"
                variant="secondary"
                disabled={status.trustedDevices === 0}
                onClick={async () => {
                  const r = await api<{ removed: number }>("POST", "/auth/two-step/forget-devices");
                  forgetTrustedTokens();
                  setMessage({ tone: "success", text: `Stopped trusting ${r.removed} computer${r.removed === 1 ? "" : "s"}.` });
                  load();
                }}
              >
                Forget all
              </Button>
            </div>
          </div>
          {!status.required && (
            <button
              className="text-sm text-red-600"
              onClick={() =>
                window.confirm("Turn off two-step sign-in? Only your password will protect your account.") &&
                withCode(async (code) => {
                  await api("POST", "/auth/two-step/disable", { code });
                  forgetTrustedTokens();
                  setMessage({ tone: "success", text: "Two-step sign-in is off." });
                  load();
                })
              }
            >
              Turn off two-step sign-in
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
