/**
 * The mark Windows editors, PowerShell's `Set-Content` and several CI checkouts
 * write at the top of a file. It is not a character the grammar has anywhere,
 * so one at offset 0 made the whole file unreadable.
 */
export const BOM = "\uFEFF";

/**
 * The column a reader sees, for a place counted over the file's own text.
 *
 * The mark is a character every editor hides, so no column may count it, while
 * every offset must: an offset is what the editor turns back into a position
 * against the text it has open, mark and all. The two pull opposite ways and
 * both are answered here, by moving the column and never the offset. Only line
 * one carries the mark.
 *
 * @param args.text The text the column was counted over, mark and all.
 * @param args.line The 1-based line the place is on.
 * @param args.column The 1-based column, counted over that text.
 * @returns The column, one to the left where the mark was counted.
 */
export function shownColumn(args: { text: string; line: number; column: number }): number {
  return args.line === 1 && args.text.startsWith(BOM) ? args.column - 1 : args.column;
}
