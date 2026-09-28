"use client";

import { useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Select, inputClass } from "@/components/ui";
import { allCountries, allTimeZones, countryLabel, gmtOffset, isCountry, regionsOf, timeZonesOf } from "@/lib/geo";

// Pickers for country, province / state and time zone. Each takes the
// id / aria-describedby that <Field> hands its child, so labels still work.

type FieldProps = { id?: string; "aria-describedby"?: string };

// A search box over every country: type "uni" or "AE" and pick.
// emptyLabel adds a "nothing chosen" option at the top (e.g. "From branch").
export function CountryPicker({
  value,
  onChange,
  emptyLabel,
  required,
  ...field
}: FieldProps & {
  value: string;
  onChange: (code: string) => void;
  emptyLabel?: string;
  required?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = allCountries().filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q,
    );
    // An exact code comes first ("sa" → Saudi Arabia), then names that start
    // with the search ("in" → India before Argentina).
    const rank = (c: { code: string; name: string }) =>
      c.code.toLowerCase() === q ? 0 : c.name.toLowerCase().startsWith(q) ? 1 : 2;
    if (q) matches.sort((a, b) => rank(a) - rank(b));
    const list: { code: string; label: string; hint?: string }[] = matches.map((c) => ({ code: c.code, label: `${c.flag} ${c.name}`, hint: c.code }));
    if (emptyLabel && !q) list.unshift({ code: "", label: emptyLabel });
    return list;
  }, [query, emptyLabel]);

  function choose(code: string) {
    onChange(code);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      const next = Math.max(0, Math.min(options.length - 1, active + (e.key === "ArrowDown" ? 1 : -1)));
      setActive(next);
      listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      if (options[active]) choose(options[active].code);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
      setQuery("");
    }
  }

  const shown = value ? countryLabel(value) : (emptyLabel ?? "");
  return (
    <div className="relative">
      <input
        {...field}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        className={`${inputClass} pr-8 ${!value && !open ? "text-slate-500" : ""}`}
        placeholder={open ? "Type to search countries" : "Choose a country"}
        value={open ? query : shown}
        // An empty "required" box blocks saving; with a country chosen the box shows its name.
        required={required && !value}
        onFocus={() => {
          setOpen(true);
          setActive(0);
        }}
        onBlur={() => {
          setOpen(false);
          setQuery("");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      {open && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg"
        >
          {options.length === 0 && <li className="px-3 py-2 text-slate-500">No country matches “{query}”</li>}
          {options.map((o, i) => (
            <li
              key={o.code || "empty"}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o.code === value}
              // mousedown, not click, so the choice lands before the box loses focus.
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o.code);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-2 px-3 py-2 ${i === active ? "bg-teal-50" : ""} ${o.code ? "" : "text-slate-500"}`}
            >
              <span className="truncate">{o.label}</span>
              {o.hint && <span className="ml-auto text-xs text-slate-400">{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// The province / state list for a country. A value the list doesn't know
// (typed before the pickers existed) stays selectable so it isn't lost.
export function RegionSelect({
  country,
  value,
  onChange,
  emptyLabel,
  ...field
}: FieldProps & {
  country: string | null | undefined;
  value: string;
  onChange: (code: string) => void;
  emptyLabel: string;
}) {
  const regions = regionsOf(country);
  const unknown = value && !regions.some((r) => r.code === value);
  return (
    <Select {...field} value={value} onChange={(e) => onChange(e.target.value)} disabled={!country}>
      <option value="">{emptyLabel}</option>
      {unknown && <option value={value}>{value}</option>}
      {regions.map((r) => (
        <option key={r.code} value={r.code}>
          {r.name}
        </option>
      ))}
    </Select>
  );
}

// Every time zone, with the chosen country's listed first.
export function TimeZoneSelect({
  country,
  value,
  onChange,
  ...field
}: FieldProps & {
  country?: string | null;
  value: string;
  onChange: (timeZone: string) => void;
}) {
  const suggested = timeZonesOf(country);
  const all = allTimeZones();
  const label = (tz: string) => `${tz.replaceAll("_", " ")} (${gmtOffset(tz)})`;
  const others = all.filter((tz) => !suggested.includes(tz));
  const unknown = value && !all.includes(value) && !suggested.includes(value);
  return (
    <Select {...field} required value={value} onChange={(e) => onChange(e.target.value)}>
      {!value && <option value="">Choose a time zone</option>}
      {unknown && <option value={value}>{value}</option>}
      {suggested.length > 0 && (
        <optgroup label={isCountry(country) ? `In ${countryLabel(country)}` : "Suggested"}>
          {suggested.map((tz) => (
            <option key={tz} value={tz}>
              {label(tz)}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label="All time zones">
        {others.map((tz) => (
          <option key={tz} value={tz}>
            {label(tz)}
          </option>
        ))}
      </optgroup>
    </Select>
  );
}
