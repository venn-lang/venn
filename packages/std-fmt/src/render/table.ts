import type { Show } from "./render.types.js";

type Row = Record<string, unknown>;

/**
 * Renders a list of records as an aligned table, for reading in a terminal.
 *
 * Columns are the union of every row's keys, in first-seen order, so a row
 * missing a field still lines up. Each column is as wide as its widest cell.
 *
 * A cell is written with `show`, the same renderer behind `print` and `${}`,
 * so a nested map or list reads the way a person would have typed it rather
 * than the host's `JSON.stringify` shape.
 *
 * This used to say that `fmt.json`, `fmt.csv`, `fmt.xml` and `fmt.yaml` kept
 * their own writers on purpose, because they answer to formats that exist
 * outside this language. They do, and it was still the wrong conclusion: a
 * format decides how a value is DELIMITED, and this language decides what the
 * value IS. Four private writers meant four of them answered `250ms` with
 * `{"kind":"duration","ms":250}`, the interpreter's envelope, which is not a
 * value any of those formats has an opinion about. They all take `show` now,
 * and each still quotes, escapes and indents by its own rules.
 *
 * @param rows The records to render. Anything that is not a record is skipped.
 * @param show The language's writer for a single value.
 * @returns The table text, or `(no rows)` when there is nothing to show.
 */
export function toTable(rows: readonly unknown[], show: Show): string {
  const records = rows.filter(isRow);
  if (records.length === 0) return "(no rows)";
  const columns = columnsOf(records);
  const widths = columns.map((column) => widthOf(column, records, show));
  return [
    line(columns, widths),
    widths.map((width) => "─".repeat(width)).join("─┼─"),
    ...records.map((row) =>
      line(
        columns.map((column) => cell(row[column], show)),
        widths,
      ),
    ),
  ].join("\n");
}

function isRow(value: unknown): value is Row {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function columnsOf(rows: readonly Row[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) for (const key of Object.keys(row)) seen.add(key);
  return [...seen];
}

function widthOf(column: string, rows: readonly Row[], show: Show): number {
  const width = (row: Row): number => cell(row[column], show).length;
  return rows.reduce((max, row) => Math.max(max, width(row)), column.length);
}

function line(values: readonly string[], widths: readonly number[]): string {
  return values.map((value, index) => value.padEnd(widths[index] ?? 0)).join(" │ ");
}

function cell(value: unknown, show: Show): string {
  return value === null || value === undefined ? "" : show(value);
}
