import Papa from "papaparse";
import { readSheet } from "read-excel-file/browser";

// Reads a .xlsx or .csv file into rows of text: the first row is the
// headings. Excel dates come back as YYYY-MM-DD.
export async function readSpreadsheet(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xls"))
    throw new Error(
      "Old .xls files can't be read — in Excel use File → Save As → .xlsx or .csv",
    );
  if (!name.endsWith(".xlsx") && !name.endsWith(".csv"))
    throw new Error("Choose an Excel (.xlsx) or .csv file");
  try {
    if (name.endsWith(".xlsx")) {
      const rows = await readSheet(file); // the first sheet
      return rows.map((row) =>
        row.map((cell) =>
          cell == null
            ? ""
            : cell instanceof Date
              ? cell.toISOString().slice(0, 10)
              : String(cell).trim(),
        ),
      );
    }
    const parsed = Papa.parse<string[]>(await file.text(), {
      skipEmptyLines: "greedy",
    });
    return parsed.data.map((row) => row.map((c) => String(c ?? "").trim()));
  } catch {
    throw new Error(
      "Could not read that file. Save it again from Excel and try once more.",
    );
  }
}

// Rows as { heading: cell } objects, leaving out completely empty rows.
export function rowsFromSheet(cells: string[][]): Record<string, string>[] {
  const [head, ...body] = cells;
  if (!head) return [];
  return body
    .filter((row) => row.some((c) => c !== ""))
    .map((row) =>
      Object.fromEntries(
        head.map((h, i) => [h, row[i] ?? ""]).filter(([h]) => h !== ""),
      ),
    );
}

// Downloads text as a file (e.g. the import template).
export function downloadText(
  fileName: string,
  text: string,
  type = "text/csv;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob(["﻿" + text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCsv(rows: string[][]) {
  return rows
    .map((r) =>
      r
        .map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c))
        .join(","),
    )
    .join("\r\n");
}
