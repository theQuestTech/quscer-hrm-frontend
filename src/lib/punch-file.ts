// Reading attendance files exported from a machine's software (CSV, or the
// tab-separated attlog.dat / .txt many machines write to a USB stick).
// Everything happens in the browser; only machine ID + time go to the server.

export type DateOrder = "YMD" | "DMY" | "MDY";

export function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 10).join("\n");
  const count = (c: string) => sample.split(c).length - 1;
  if (count("\t") > 0) return "\t";
  return count(";") > count(",") ? ";" : ",";
}

// A small CSV reader that understands quotes ("a, b" and "" inside quotes).
export function parseRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

const pad = (n: number) => String(n).padStart(2, "0");

// "2026-10-01 09:02", "01/10/2026 9:02:11 AM", "10/1/2026" + "9:02 PM" →
// "2026-10-01 09:02:11" (local machine time), or null.
export function readDateTime(dateText: string, timeText: string | undefined, order: DateOrder): string | null {
  let d = dateText.trim();
  let t = (timeText ?? "").trim();
  if (!t) {
    const m = /^(\S+)\s+(.+)$/.exec(d.replace("T", " "));
    if (!m) return null;
    d = m[1];
    t = m[2];
  }
  const dp = d.split(/[-/.]/).map((x) => x.trim());
  if (dp.length !== 3 || dp.some((x) => !/^\d+$/.test(x))) return null;
  let y: number, mo: number, day: number;
  if (dp[0].length === 4) [y, mo, day] = dp.map(Number) as [number, number, number];
  else if (order === "DMY") [day, mo, y] = dp.map(Number) as [number, number, number];
  else if (order === "MDY") [mo, day, y] = dp.map(Number) as [number, number, number];
  else [y, mo, day] = dp.map(Number) as [number, number, number];
  if (y < 100) y += 2000;
  const tm = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/.exec(t);
  if (!tm) return null;
  let h = Number(tm[1]);
  const mi = Number(tm[2]);
  const s = tm[3] ? Number(tm[3]) : 0;
  const ampm = tm[4]?.toUpperCase();
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  if (mo < 1 || mo > 12 || day < 1 || day > 31 || h > 23 || mi > 59 || s > 59) return null;
  return `${y}-${pad(mo)}-${pad(day)} ${pad(h)}:${pad(mi)}:${pad(s)}`;
}

// Guess the date order from the values (a first part over 12 means day first).
export function guessOrder(samples: string[]): DateOrder {
  for (const s of samples) {
    const p = s.trim().split(/[\sT]/)[0].split(/[-/.]/);
    if (p.length !== 3) continue;
    if (p[0].length === 4) return "YMD";
    if (Number(p[0]) > 12) return "DMY";
    if (Number(p[1]) > 12) return "MDY";
  }
  return "DMY"; // Pakistan writes day first
}
