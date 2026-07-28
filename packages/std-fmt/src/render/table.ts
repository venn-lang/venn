type Row = Record<string, unknown>;

/**
 * Renders a list of records as an aligned table, for reading in a terminal.
 *
 * Columns are the union of every row's keys, in first-seen order, so a row
 * missing a field still lines up. Each column is as wide as its widest cell.
 *
 * @param rows The records to render. Anything that is not a record is skipped.
 * @returns The table text, or `(no rows)` when there is nothing to show.
 */
export function toTable(rows: readonly unknown[]): string {
  const records = rows.filter(isRow);
  if (records.length === 0) return "(no rows)";
  const columns = columnsOf(records);
  const widths = columns.map((column) => widthOf(column, records));
  return [
    line(columns, widths),
    widths.map((width) => "─".repeat(width)).join("─┼─"),
    ...records.map((row) =>
      line(
        columns.map((column) => cell(row[column])),
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

function widthOf(column: string, rows: readonly Row[]): number {
  return rows.reduce((width, row) => Math.max(width, cell(row[column]).length), column.length);
}

function line(values: readonly string[], widths: readonly number[]): string {
  return values.map((value, index) => value.padEnd(widths[index] ?? 0)).join(" │ ");
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
