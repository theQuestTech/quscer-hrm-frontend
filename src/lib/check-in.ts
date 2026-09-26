"use client";

import { api } from "./api";
import type { AttendanceRecord } from "./types";

// What the company allows this person, from GET /attendance/today.
export interface CheckInRules {
  method: "APP" | "MACHINE" | "BOTH";
  canUseApp: boolean;
  needsOfficeNetwork: boolean;
  needsOfficeLocation: boolean;
}

export interface TodayResponse {
  employeeLinked: boolean;
  date: string | null;
  record: AttendanceRecord | null;
  rules: CheckInRules | null;
}

// The browser's location, asked for only when the company requires it.
export function currentLocation(): Promise<{ latitude: number; longitude: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("This browser can't share your location. Try your phone's browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Allow location access for this site (your browser's address bar), then try again. Your company only lets you check in at the office."
              : "Couldn't get your location. Turn on location/GPS and try again.",
          ),
        ),
      // Always a fresh reading: a cached one could still say "on the way to the office".
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

// Check in or out, sending the location when the rules need it.
export async function checkInOut(mode: "check-in" | "check-out", rules: CheckInRules | null) {
  const body = rules?.needsOfficeLocation ? await currentLocation() : {};
  return api("POST", `/attendance/${mode}`, body);
}
