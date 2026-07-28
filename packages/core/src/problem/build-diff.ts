import type { Diff, DiffEntry } from "./diff.types.js";
import { clamp, formatValue } from "./format-value.js";

/** Past this many fields a wall of text stops being a diff. */
const MAX_ENTRIES = 40;

/**
 * Past this the walk stops descending. A value that contains itself has no
 * bottom, and a stack overflow inside a failure report is a crash, not a report.
 */
const MAX_DEPTH = 16;

/**
 * Turn the two sides a producer compared into a {@link Diff}. Two structures are
 * walked field by field, so the failure names the field that moved instead of
 * printing the same rendering twice; anything else stays a plain pair.
 */
export function buildDiff(args: {
  /** Heading for the field-by-field form. */
  label: string;
  expected: unknown;
  actual: unknown;
  /**
   * Whether the two sides correspond position by position. Pass `false` for a
   * comparison that does not, such as `contains`. See {@link walkable}.
   */
  aligned?: boolean;
}): Diff {
  const entries: DiffEntry[] = [];
  const { expected, actual } = args;
  if (walkable(args)) walk({ expected, actual, path: "", entries, depth: 0 });
  if (entries.length === 0) return pair(expected, actual);
  return { kind: "fields", label: args.label, entries };
}

/**
 * A field-by-field walk claims the two sides correspond position by position.
 * `equals` claims that; `contains` holds one needle against every item, and
 * lining that needle up with the haystack would invent a comparison nobody
 * made, such as `[0] expected 5, actual [1,2]`.
 */
function walkable(args: { expected: unknown; actual: unknown; aligned?: boolean }): boolean {
  return args.aligned !== false && comparable(args.expected, args.actual);
}

function pair(expected: unknown, actual: unknown): Diff {
  return {
    kind: "scalar",
    expected: clamp(formatValue(expected)),
    actual: clamp(formatValue(actual)),
  };
}

/** Only two structures of the same shape are worth walking side by side. */
function comparable(expected: unknown, actual: unknown): boolean {
  if (Array.isArray(expected) !== Array.isArray(actual)) return false;
  return isStructure(expected) && isStructure(actual);
}

function isStructure(value: unknown): boolean {
  return typeof value === "object" && value !== null;
}

function walk(args: {
  expected: unknown;
  actual: unknown;
  path: string;
  entries: DiffEntry[];
  depth: number;
}): void {
  const list = Array.isArray(args.expected);
  for (const key of keysOf(args.expected, args.actual)) {
    if (args.entries.length >= MAX_ENTRIES) return;
    visit({ from: args, key, path: childPath({ parent: args.path, key, list }) });
  }
}

/**
 * One field of the walk. It descends only where the two sides disagree: an
 * untouched subtree is worth one line of context, not fifty.
 */
function visit(args: {
  from: { expected: unknown; actual: unknown; entries: DiffEntry[]; depth: number };
  key: string;
  path: string;
}): void {
  const expected = read(args.from.expected, args.key);
  const actual = read(args.from.actual, args.key);
  const { entries, depth } = args.from;
  const entry = entryOf(args.path, expected, actual);
  if (entry.same || depth >= MAX_DEPTH || !comparable(expected, actual)) entries.push(entry);
  else walk({ expected, actual, path: args.path, entries, depth: depth + 1 });
}

function entryOf(path: string, expected: unknown, actual: unknown): DiffEntry {
  const left = formatValue(expected);
  const right = formatValue(actual);
  return { path, expected: clamp(left), actual: clamp(right), same: left === right };
}

/** Every field either side has, in expected-first order. */
function keysOf(expected: unknown, actual: unknown): string[] {
  const keys = Object.keys(expected as object);
  for (const key of Object.keys(actual as object)) {
    if (!keys.includes(key)) keys.push(key);
  }
  return keys;
}

function childPath(args: { parent: string; key: string; list: boolean }): string {
  return args.list ? `${args.parent}[${args.key}]` : `${args.parent}.${args.key}`;
}

function read(value: unknown, key: string): unknown {
  return (value as Record<string, unknown>)[key];
}
