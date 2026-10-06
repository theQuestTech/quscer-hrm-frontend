"use client";

import { useState } from "react";
import { supportApi, useSupportApi } from "@/lib/support";
import { formatRelative } from "@/lib/format";
import { Alert, Button, Card } from "@/components/ui";

interface DemoStatus {
  available: boolean;
  running: boolean;
  demo: { id: string; createdAt: string } | null;
  logins: { hr: string; manager: string; employee: string } | null;
}

// Staging only: the demo company and a button to build it fresh before a demo.
export function SupportDemo() {
  const status = useSupportApi<DemoStatus>("/support/demo");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const s = status.data;
  if (!s?.available) return null;

  async function rebuild() {
    if (!confirm("Rebuild the demo company? Everything in it is replaced with fresh demo data (about 30 seconds).")) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await supportApi<{ steps: string[] }>("POST", "/support/demo/reset");
      setResult({ ok: true, text: r.steps.filter((x) => !x.startsWith("Done") && !x.startsWith("Manager")).join(" · ") });
      status.reload?.();
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : "Couldn't rebuild the demo" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">Demo company (staging)</h2>
          <p className="mt-1 text-sm text-slate-600">
            {s.demo ? `Al-Noor Traders (Demo), built ${formatRelative(s.demo.createdAt)}.` : "Not built yet."} Password for all three: <span className="font-mono">Demo-Quscer-2026</span>
          </p>
          {s.logins && (
            <ul className="mt-2 space-y-0.5 text-sm text-slate-600">
              <li>
                HR admin: <span className="font-mono">{s.logins.hr}</span> (authenticator key from the staging guide)
              </li>
              <li>
                Manager: <span className="font-mono">{s.logins.manager}</span>
              </li>
              <li>
                Employee: <span className="font-mono">{s.logins.employee}</span>
              </li>
            </ul>
          )}
        </div>
        <Button onClick={rebuild} loading={busy || s.running}>
          {busy ? "Rebuilding…" : "Rebuild demo"}
        </Button>
      </div>
      {result && (
        <div className="mt-3">
          <Alert tone={result.ok ? "success" : "error"}>{result.text}</Alert>
        </div>
      )}
    </Card>
  );
}
