type Row = Record<string, unknown>;

/** The language's own writer, bound in by the runtime. See `ActionContext.show`. */
type Show = (value: unknown) => string;

/**
 * Renders a list of records as an aligned table, for reading in a terminal.
 *
 * Columns are the union of every row's keys, in first-seen order, so a row
 * missing a field still lines up. Each column is as wide as its widest cell.
 *
 * A cell is written with `show`, the same renderer behind `print` and `${}`,
 * so a nested map or list reads the way a person would have typed it rather
 * than the host's `JSON.stringify` shape. `fmt.json`, `fmt.csv`, `fmt.xml`
 * and `fmt.yaml` keep their own writers on purpose: they answer to formats
 * that exist outside this language, and a CSV field written the Venn way
 * would be a broken CSV. A table answers to nobody but the person reading it.
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
