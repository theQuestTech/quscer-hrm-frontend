"use client";

import { useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { useApi } from "@/lib/use-api";
import { type TodayResponse, checkInOut } from "@/lib/check-in";
import { formatDate, formatTime } from "@/lib/format";
import { Alert, Button, Card } from "./ui";

export function CheckInWidget({ onChange }: { onChange?: () => void }) {
  const { data, loading, reload } = useApi<TodayResponse>("/attendance/today");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(path: "check-in" | "check-out") {
    setBusy(true);
    setError(null);
    try {
      await checkInOut(path, data?.rules ?? null);
      await reload();
      onChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !data?.employeeLinked) return null;
  const record = data.record;

  return (
    <Card title={`Today · ${formatDate(data.date)}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <dl className="flex gap-8 text-sm">
          <div>
            <dt className="text-slate-500">Checked in</dt>
            <dd className="mt-0.5 text-lg font-semibold">{formatTime(record?.checkIn)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Checked out</dt>
            <dd className="mt-0.5 text-lg font-semibold">{formatTime(record?.checkOut)}</dd>
          </div>
        </dl>
        {data.rules && !data.rules.canUseApp ? (
          <p className="text-sm text-slate-500">Recorded by the attendance machine</p>
        ) : !record?.checkIn ? (
          <Button onClick={() => act("check-in")} loading={busy}>
            <LogIn className="size-4" /> Check in
          </Button>
        ) : !record.checkOut ? (
          <Button variant="secondary" onClick={() => act("check-out")} loading={busy}>
            <LogOut className="size-4" /> Check out
          </Button>
        ) : (
          <p className="text-sm text-slate-500">Done for today</p>
        )}
      </div>
      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}
    </Card>
  );
}
