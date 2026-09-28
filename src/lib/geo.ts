import data from "./geo-data.json";
import { countryName } from "./format";

// Countries, their provinces / states and time zones, for the pickers.
// Built by scripts/build-geo.mjs.

type Geo = Record<string, { r: [string, string][]; tz: string[] }>;
const GEO = data as unknown as Geo;

export interface Country {
  code: string;
  name: string;
  flag: string;
}

// "PK" → "🇵🇰"
export function flag(code: string): string {
  if (!/^[A-Z]{2}$/i.test(code)) return "";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

let countries: Country[] | null = null;
export function allCountries(): Country[] {
  countries ??= Object.keys(GEO)
    .map((code) => ({ code, name: countryName(code), flag: flag(code) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return countries;
}

export function isCountry(code: string | null | undefined): boolean {
  return !!code && code.toUpperCase() in GEO;
}

// "🇵🇰 Pakistan"; unknown codes are shown as typed.
export function countryLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return isCountry(code) ? `${flag(code)} ${countryName(code)}` : code;
}

export function regionsOf(countryCode: string | null | undefined): { code: string; name: string }[] {
  return (GEO[(countryCode ?? "").toUpperCase()]?.r ?? []).map(([code, name]) => ({ code, name }));
}

// "PB" in PK → "Punjab". Without a country, Pakistan is assumed (its codes
// are what older records hold); an unknown code is shown as it is.
export function regionName(code: string, countryCode?: string | null): string {
  const cc = (countryCode ?? "PK").toUpperCase();
  return GEO[cc]?.r.find(([c]) => c === code)?.[1] ?? code;
}

export function timeZonesOf(countryCode: string | null | undefined): string[] {
  return GEO[(countryCode ?? "").toUpperCase()]?.tz ?? [];
}

let zones: string[] | null = null;
export function allTimeZones(): string[] {
  if (!zones) {
    try {
      zones = Intl.supportedValuesOf("timeZone");
    } catch {
      zones = [...new Set(Object.values(GEO).flatMap((c) => c.tz))].sort();
    }
  }
  return zones;
}

// "Asia/Karachi" → "GMT+5" (as of today, so summer time shows when it's on).
const offsets = new Map<string, string>();
export function gmtOffset(timeZone: string): string {
  if (!offsets.has(timeZone)) {
    let value = "";
    try {
      value =
        new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "shortOffset" })
          .formatToParts(new Date())
          .find((p) => p.type === "timeZoneName")?.value ?? "";
    } catch {
      // An unknown zone just shows without an offset.
    }
    offsets.set(timeZone, value);
  }
  return offsets.get(timeZone)!;
}
