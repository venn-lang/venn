import type { Show } from "./render.types.js";

type Row = Record<string, unknown>;

/**
 * Renders a list of records as CSV with a header row.
 *
 * Columns are the union of every record's keys, in first-seen order, so a
 * record missing a field still lines up. A field is quoted only when it holds a
 * separator, a quote or a newline, and inner quotes are doubled (RFC 4180).
 *
 * A field is written with `show`, the language's own writer, so `250ms` is the
 * text `250ms`. This file used to reach for `JSON.stringify` and produced
 * `"{""kind"":""duration"",""ms"":250}"` for the same cell.
 *
 * @param rows The records to render. Anything that is not a record is skipped.
 * @param show The language's writer for a single value.
 * @param separator What goes between fields. A comma by default.
 * @returns The CSV text, or an empty string when no record survives the filter.
 */
export function toCsv(rows: readonly unknown[], show: Show, separator = ","): string {
  const records = rows.filter(isRow);
  if (records.length === 0) return "";
  const columns = columnsOf(records);
  const header = columns.map(quote).join(separator);
  const body = records.map((row) => columns.map((c) => quote(cell(row[c], show))).join(separator));
  return [header, ...body].join("\n");
}

function isRow(value: unknown): value is Row {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function columnsOf(rows: readonly Row[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) for (const key of Object.keys(row)) seen.add(key);
  return [...seen];
}

function cell(value: unknown, show: Show): string {
  return value === null || value === undefined ? "" : show(value);
}

/** Quote when the field holds a separator, a quote or a newline; double inner quotes. */
function quote(field: string): string {
  if (!/[",;\t\n\r]/.test(field)) return field;
  return `"${field.replace(/"/g, '""')}"`;
}
