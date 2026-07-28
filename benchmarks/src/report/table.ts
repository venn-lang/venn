/** Render rows as an aligned text table, header first. */
export function table(rows: readonly (readonly string[])[]): string {
  const widths = columnWidths(rows);
  const [header, ...body] = rows;
  if (!header) return "";
  return [line(header, widths), divider(widths), ...body.map((row) => line(row, widths))].join(
    "\n",
  );
}

function columnWidths(rows: readonly (readonly string[])[]): number[] {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, at) => {
      widths[at] = Math.max(widths[at] ?? 0, cell.length);
    });
  }
  return widths;
}

function line(row: readonly string[], widths: readonly number[]): string {
  return row.map((cell, at) => pad(cell, widths[at] ?? 0, at === 0)).join("  ");
}

function pad(cell: string, width: number, left: boolean): string {
  return left ? cell.padEnd(width) : cell.padStart(width);
}

function divider(widths: readonly number[]): string {
  return widths.map((width) => "─".repeat(width)).join("  ");
}
