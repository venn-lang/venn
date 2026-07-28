import type { CsvRow } from "./csv.types.js";

/**
 * Parse a CSV string into row objects. The first line supplies the headers.
 *
 * A minimal splitter: it takes inline content only (never a path) and does not
 * understand quoting, so a quoted cell containing a comma splits in two.
 *
 * @param content The CSV text. Blank lines are skipped.
 * @returns One object per data line, keyed by header. Empty when there is no header line.
 */
export function parseCsv(content: string): CsvRow[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== "");
  const [header, ...rows] = lines;
  if (header === undefined) return [];
  const headers = splitLine(header);
  return rows.map((row) => toRow(headers, splitLine(row)));
}

function splitLine(line: string): string[] {
  return line.split(",").map((cell) => cell.trim());
}

function toRow(headers: readonly string[], cells: readonly string[]): CsvRow {
  const row: CsvRow = {};
  headers.forEach((key, index) => {
    row[key] = cells[index] ?? "";
  });
  return row;
}
