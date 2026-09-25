"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatTime } from "@/lib/format";
import type { AttendanceRecord } from "@/lib/types";
import { Icon } from "./figma-icons";

// "Slide to time in" in the top bar. Drag the knob to the end (or focus it
// and press Enter) to time in; then the same switch times you out. Only shown to
// people with an employee profile. Other parts of the page (dashboard
// calendar, attendance history) listen for "hrm:attendance-changed".

interface TodayResponse {
  employeeLinked: boolean;
  date: string | null;
  record: AttendanceRecord | null;
}

const KNOB = 32;
const PAD = 4;

export function TimeSlider() {
  const { me } = useAuth();
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const start = useRef<number | null>(null);

  async function load() {
    try {
      setToday(await api<TodayResponse>("GET", "/attendance/today"));
    } catch {
      setToday(null);
    }
  }

  useEffect(() => {
    if (me?.employee) load();
  }, [me?.employee, me?.organization.id]);

  if (!me?.employee || !today?.employeeLinked) return null;

  const record = today.record;
  const mode: "in" | "out" | "done" = !record?.checkIn ? "in" : !record.checkOut ? "out" : "done";
  const max = () => (track.current ? track.current.clientWidth - KNOB - PAD * 2 : 0);

  async function act() {
    if (mode === "done" || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api("POST", `/attendance/${mode === "in" ? "check-in" : "check-out"}`);
      await load();
      window.dispatchEvent(new Event("hrm:attendance-changed"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
      setDrag(0);
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (mode === "done" || busy) return;
    start.current = e.clientX - drag;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (start.current === null) return;
    setDrag(Math.max(0, Math.min(max(), e.clientX - start.current)));
  };
  const onPointerUp = () => {
    if (start.current === null) return;
    start.current = null;
    // Sliding (not a tap) avoids timing in by accident; keyboard users
    // press Enter on the knob instead.
    if (drag >= max() * 0.85) act();
    else setDrag(0);
  };

  const label =
    mode === "in"
      ? "Slide to time in"
      : mode === "out"
        ? `In ${formatTime(record!.checkIn)} · Slide to time out`
        : `Done · ${formatTime(record!.checkIn)} – ${formatTime(record!.checkOut)}`;
  const tone =
    mode === "in"
      ? { track: "#e8faf8", knob: "#00b4a6", text: "#00857a" }
      : mode === "out"
        ? { track: "#fff7ed", knob: "#f59e0b", text: "#b45309" }
        : { track: "#f3f4f6", knob: "#9ca3af", text: "#6b7280" };

  return (
    <div className="relative">
      <div
        ref={track}
        className="relative flex h-10 w-64 select-none items-center overflow-hidden rounded-xl border border-gray-200"
        style={{ backgroundColor: tone.track }}
      >
        <span
          className="pointer-events-none w-full truncate pl-11 pr-3 text-xs font-semibold"
          style={{ color: tone.text, opacity: 1 - drag / Math.max(max(), 1) }}
        >
          {busy ? "Saving…" : label}
        </span>
        <button
          type="button"
          aria-label={mode === "in" ? "Time in" : mode === "out" ? "Time out" : "Timed out for today"}
          disabled={mode === "done" || busy}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            start.current = null;
            setDrag(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              act();
            }
          }}
          className="absolute flex touch-none items-center justify-center rounded-lg text-white shadow-sm transition-[left] disabled:cursor-default"
          style={{
            width: KNOB,
            height: KNOB,
            left: PAD + drag,
            backgroundColor: tone.knob,
            transitionDuration: start.current === null ? "200ms" : "0ms",
          }}
        >
          <Icon name={mode === "in" ? "log-in" : mode === "out" ? "log-out" : "check-circle"} size={16} color="#fff" />
        </button>
      </div>
      {error && (
        <p role="alert" className="absolute left-0 top-11 z-10 w-64 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
