import type { Money } from "./types";

// Dates from the API are either timestamps or "calendar days" stored as
// midnight UTC. Calendar days are formatted in UTC so 1 Oct never shows as
// 30 Sep for someone west of Greenwich.

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// 65 → "1h 5m"; 0 or null → "—".
export function formatMinutes(value: number | null | undefined): string {
  if (!value) return "—";
  const h = Math.floor(value / 60);
  const m = value % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

// "just now", "5 min ago", "3 h ago", "yesterday", then a date.
export function formatRelative(value: string, now = Date.now()): string {
  const seconds = Math.round((now - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  if (hours < 48) return "yesterday";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatMonth(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function formatMoney(value: Money | null | undefined, currency = "PKR"): string {
  if (value === null || value === undefined) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  try {
    // "PKR 180,000" as in the design (currency code, not "Rs").
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency,
      currencyDisplay: "code",
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString()}`;
  }
}

// YYYY-MM-DD for <input type="date"> values.
export function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export function todayInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function fullName(p: { firstName: string; lastName: string } | null | undefined): string {
  return p ? `${p.firstName} ${p.lastName}` : "—";
}

export function humanize(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Pakistan provinces/territories as used by the statutory rules (regionCode).
export const PK_REGIONS = [
  { code: "PB", name: "Punjab" },
  { code: "SD", name: "Sindh" },
  { code: "KP", name: "Khyber Pakhtunkhwa" },
  { code: "BA", name: "Balochistan" },
  { code: "ICT", name: "Islamabad Capital Territory" },
];
