import { keyOf, tableSpan } from "./table-span.js";

/** What to change, and in which table. */
export interface DependencyEdit {
  /** The manifest as written. */
  text: string;
  name: string;
  /** Defaults to {@link DEPENDENCIES}. Pass `"dev-dependencies"` for the other. */
  table?: string;
}

/** The table an edit touches unless told otherwise. */
export const DEPENDENCIES = "dependencies";

/**
 * The manifest with one dependency written in, everything else untouched.
 *
 * Entries are kept in name order, so two people adding two packages produce two
 * one-line diffs rather than a conflict. A name already there is replaced where
 * it stands, because an upgrade should not move the line.
 *
 * @returns the whole manifest as text. A missing table is appended at the end.
 */
export function addDependency(args: DependencyEdit & { version: string }): string {
  const table = args.table ?? DEPENDENCIES;
  const lines = args.text.split("\n");
  const entry = `${args.name} = "${args.version}"`;
  const span = tableSpan(lines, table);
  if (!span) return appended(args.text, table, entry);
  const at = lines.findIndex((line, index) => inside(span, index) && keyOf(line) === args.name);
  if (at >= 0) return replaced(lines, at, entry);
  return replaced(lines, insertionPoint(lines, span, args.name), entry, "insert");
}

/**
 * The manifest without that dependency.
 *
 * @returns the text unchanged when the name is not there: absent is already the
 * wanted state.
 */
export function removeDependency(args: DependencyEdit): string {
  const table = args.table ?? DEPENDENCIES;
  const lines = args.text.split("\n");
  const span = tableSpan(lines, table);
  if (!span) return args.text;
  const at = lines.findIndex((line, index) => inside(span, index) && keyOf(line) === args.name);
  if (at < 0) return args.text;
  return [...lines.slice(0, at), ...lines.slice(at + 1)].join("\n");
}

function inside(span: { from: number; to: number }, index: number): boolean {
  return index >= span.from && index < span.to;
}

/** Where the name belongs, in order, among the entries already there. */
function insertionPoint(
  lines: readonly string[],
  span: { from: number; to: number },
  name: string,
): number {
  for (let at = span.from; at < span.to; at++) {
    const key = keyOf(lines[at] ?? "");
    if (key && key > name) return at;
  }
  return span.to;
}

function replaced(
  lines: readonly string[],
  at: number,
  entry: string,
  how: "replace" | "insert" = "replace",
): string {
  const after = how === "insert" ? lines.slice(at) : lines.slice(at + 1);
  return [...lines.slice(0, at), entry, ...after].join("\n");
}

/** A table the manifest does not have yet, written at the end where it reads. */
function appended(text: string, table: string, entry: string): string {
  const body = text.endsWith("\n") ? text : `${text}\n`;
  return `${body}\n[${table}]\n${entry}\n`;
}
