// Builds src/lib/geo-data.json: every country's provinces / states and time
// zones, for the pickers. Run after updating country-region-data:
//   node scripts/build-geo.mjs
// Regions come from country-region-data (MIT); time zones from the IANA
// zone.tab that ships with the OS (/usr/share/zoneinfo/zone.tab).
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const countries = require("country-region-data/data.json");

// Where payroll rules differ from the ISO list, use the areas the rules are
// written for. Codes here must match the statutory rules (e.g. Pakistan's
// "ICT"), so change them only together with the rules.
const OVERRIDES = {
  PK: [
    ["PB", "Punjab"],
    ["SD", "Sindh"],
    ["KP", "Khyber Pakhtunkhwa"],
    ["BA", "Balochistan"],
    ["ICT", "Islamabad Capital Territory"],
    ["GB", "Gilgit-Baltistan"],
    ["JK", "Azad Jammu and Kashmir"],
  ],
  // The UK's list is 200+ councils; tax differs by nation.
  GB: [
    ["ENG", "England"],
    ["SCT", "Scotland"],
    ["WLS", "Wales"],
    ["NIR", "Northern Ireland"],
  ],
};

// zone.tab has no entry for these; use their neighbours' zone.
const zones = { XK: ["Europe/Belgrade"] };
for (const line of readFileSync("/usr/share/zoneinfo/zone.tab", "utf8").split("\n")) {
  if (!line || line.startsWith("#")) continue;
  const [cc, , tz] = line.split("\t");
  (zones[cc] ??= []).push(tz);
}

const out = {};
for (const c of countries) {
  const cc = c.countryShortCode;
  const regions =
    OVERRIDES[cc] ??
    c.regions
      .filter((r) => r.shortCode) // a few tiny territories have no codes; they need no province / state
      .map((r) => [r.shortCode.toUpperCase(), r.name])
      .sort((a, b) => a[1].localeCompare(b[1]));
  out[cc] = { r: regions, tz: zones[cc] ?? [] };
}

writeFileSync(new URL("../src/lib/geo-data.json", import.meta.url), JSON.stringify(out) + "\n");
console.log(`${Object.keys(out).length} countries, ${Object.values(out).reduce((n, c) => n + c.r.length, 0)} provinces / states`);
