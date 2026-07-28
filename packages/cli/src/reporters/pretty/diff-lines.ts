import { type Diff, type DiffEntry, formatValue } from "@venn-lang/core";
import { bold, dim, green, red } from "../colors.js";

const INDENT = "     ";
const COLUMN = "expected".length;

/**
 * The body of a failure: the two sides as the kernel compared them, field by
 * field (§16). The title says what went wrong in one line; this says where.
 */
export function diffLines(diff: Diff): string[] {
  if (diff.kind === "fields") return fieldLines(diff.label, diff.entries);
  if (diff.kind === "json") {
    return [head(diff.path), ...pairLines(formatValue(diff.expected), formatValue(diff.actual))];
  }
  return pairLines(diff.expected, diff.actual);
}

function fieldLines(label: string, entries: readonly DiffEntry[]): string[] {
  const width = Math.max(0, ...entries.map((entry) => entry.path.length));
  const lines = [head(label)];
  for (const [index, entry] of entries.entries()) {
    lines.push(...entryLines({ entry, width, last: index === entries.length - 1 }));
  }
  return lines;
}

/** One field: a single line when both sides agree, two when they do not. */
function entryLines(args: { entry: DiffEntry; width: number; last: boolean }): string[] {
  const { entry, last, width } = args;
  const branch = `${INDENT}${dim(last ? "└" : "├")} ${entry.path.padEnd(width)}`;
  if (entry.same) return [`${branch}  ${column("same")}  ${dim(entry.expected)}`];
  const gutter = `${INDENT}${dim(last ? " " : "│")} ${" ".repeat(width)}`;
  return [
    `${branch}  ${column("expected")}  ${green(entry.expected)}`,
    `${gutter}  ${column("actual")}  ${red(entry.actual)}`,
  ];
}

function pairLines(expected: string, actual: string): string[] {
  return [
    `${INDENT}${column("expected")}  ${green(expected)}`,
    `${INDENT}${column("actual")}  ${red(actual)}`,
  ];
}

function head(label: string): string {
  return `${INDENT}${bold(label)}`;
}

function column(label: string): string {
  return dim(label.padEnd(COLUMN));
}
