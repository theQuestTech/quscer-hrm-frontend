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

// Where someone's tax is worked out: their own country and province/state,
// else their branch's (the same rule payroll uses).
export function jurisdictionOf(e: {
  countryCode: string | null;
  regionCode: string | null;
  branch?: { countryCode: string; regionCode: string | null } | null;
}): { countryCode: string | null; regionCode: string | null; fromBranch: boolean } {
  if (e.countryCode) {
    const useBranch = !e.regionCode && e.branch?.countryCode === e.countryCode && !!e.branch.regionCode;
    return { countryCode: e.countryCode, regionCode: e.regionCode ?? (useBranch ? e.branch!.regionCode : null), fromBranch: useBranch };
  }
  if (e.branch) return { countryCode: e.branch.countryCode, regionCode: e.branch.regionCode, fromBranch: true };
  return { countryCode: null, regionCode: null, fromBranch: false };
}

// "AE" → "United Arab Emirates".
export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export function initials(p: { firstName: string; lastName: string }): string {
  return `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();
}

// Adds up pay per currency: PKR and AED are never added together. The
// currency with the most people comes first.
export function totalsByCurrency<T extends { currency: string }>(items: T[], amount: (item: T) => Money): { currency: string; amount: number }[] {
  const sums = new Map<string, { amount: number; people: number }>();
  for (const item of items) {
    const t = sums.get(item.currency) ?? { amount: 0, people: 0 };
    t.amount += Number(amount(item));
    t.people += 1;
    sums.set(item.currency, t);
  }
  return [...sums]
    .sort(([a, x], [b, y]) => y.people - x.people || a.localeCompare(b))
    .map(([currency, t]) => ({ currency, amount: Math.round(t.amount * 100) / 100 }));
}
