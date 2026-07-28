import { truthy } from "../../value/index.js";
import { type Invoke, type Method, nativeFn } from "../native.types.js";

const num = (value: unknown): number => Number(value);

/** Selecting, ordering and summarising: the other half of everyday list work. */
export const LIST_SELECTION: Record<string, Method> = {
  take: (list: readonly unknown[]) => nativeFn((args) => list.slice(0, count(args[0]))),
  drop: (list: readonly unknown[]) => nativeFn((args) => list.slice(count(args[0]))),
  // Counted from the front, because `slice(-0)` is `slice(0)` and would hand
  // back the whole list when asked for none of it.
  takeLast: (list: readonly unknown[]) =>
    nativeFn((args) => list.slice(Math.max(0, list.length - count(args[0])))),
  dropLast: (list: readonly unknown[]) =>
    nativeFn((args) => list.slice(0, Math.max(0, list.length - count(args[0])))),
  takeWhile: (list: readonly unknown[], invoke: Invoke) =>
    nativeFn((args) => list.slice(0, edge(list, args[0], invoke))),
  dropWhile: (list: readonly unknown[], invoke: Invoke) =>
    nativeFn((args) => list.slice(edge(list, args[0], invoke))),
  distinct: (list: readonly unknown[]) => distinct(list, (item) => item),
  distinctBy: (list: readonly unknown[], invoke: Invoke) =>
    nativeFn((args) => distinct(list, (item, i) => invoke.two(args[0], item, i))),
  sortBy: (list: readonly unknown[], invoke: Invoke) =>
    nativeFn((args) => sortBy(list, (item, i) => invoke.two(args[0], item, i))),
  minBy: (list: readonly unknown[], invoke: Invoke) =>
    nativeFn((args) => best(list, (item, i) => num(invoke.two(args[0], item, i)), -1)),
  maxBy: (list: readonly unknown[], invoke: Invoke) =>
    nativeFn((args) => best(list, (item, i) => num(invoke.two(args[0], item, i)), 1)),
  sumBy: (list: readonly unknown[], invoke: Invoke) =>
    nativeFn((args) =>
      list.reduce((total: number, x, i) => total + num(invoke.two(args[0], x, i)), 0),
    ),
  flatMap: (list: readonly unknown[], invoke: Invoke) =>
    nativeFn((args) => list.flatMap((item, i) => flatten(invoke.two(args[0], item, i)))),
  sum: (list: readonly unknown[]) => list.reduce((total: number, x) => total + num(x), 0),
  average: (list: readonly unknown[]) =>
    list.length === 0 ? 0 : list.reduce((total: number, x) => total + num(x), 0) / list.length,
  // Folded rather than spread: `Math.min(...list)` passes every element as an
  // argument, and a list of a few hundred thousand overflows the call stack.
  min: (list: readonly unknown[]) => extreme(list, -1),
  max: (list: readonly unknown[]) => extreme(list, 1),
  /** The inverse of a map's `entries`: `[["a", 1]].toMap` gives `{ a: 1 }`. */
  toMap: (list: readonly unknown[]) => toMap(list),
  isEmpty: (list: readonly unknown[]) => list.length === 0,
};

function toMap(list: readonly unknown[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const entry of list) {
    const pair = Array.isArray(entry) ? entry : [];
    if (pair.length > 0) out[String(pair[0])] = pair[1];
  }
  return out;
}

function count(value: unknown): number {
  return Math.max(0, Math.trunc(Number(value ?? 0)));
}

/** The smallest or largest number in a list, or null when there is none. */
function extreme(list: readonly unknown[], direction: 1 | -1): number | null {
  if (list.length === 0) return null;
  let best = num(list[0]);
  for (let at = 1; at < list.length; at += 1) {
    const value = num(list[at]);
    if (Number.isNaN(value)) return Number.NaN;
    if (value * direction > best * direction) best = value;
  }
  return best;
}

/** Where the run of items satisfying the predicate ends. */
function edge(list: readonly unknown[], fn: unknown, invoke: Invoke): number {
  let index = 0;
  while (index < list.length && truthy(invoke.two(fn, list[index], index))) index += 1;
  return index;
}

function distinct(
  list: readonly unknown[],
  keyOf: (item: unknown, i: number) => unknown,
): unknown[] {
  const seen = new Set<string>();
  const out: unknown[] = [];
  list.forEach((item, index) => {
    const key = JSON.stringify(keyOf(item, index)) ?? "";
    if (seen.has(key)) return;
    seen.add(key);
    out.push(item);
  });
  return out;
}

/**
 * Sort by a derived key, ordering positions rather than the items themselves.
 *
 * The keys go in one array and the positions in another, so the sort moves
 * numbers and nothing is allocated per item. It stays stable, which is what
 * leaves items whose keys tie in the order they came.
 */
function sortBy(list: readonly unknown[], keyOf: (item: unknown, i: number) => unknown): unknown[] {
  const size = list.length;
  const keys = new Array<unknown>(size);
  const order = new Array<number>(size);
  for (let at = 0; at < size; at += 1) {
    keys[at] = keyOf(list[at], at);
    order[at] = at;
  }
  order.sort((left, right) => compare(keys[left], keys[right]));
  const out = new Array<unknown>(size);
  for (let at = 0; at < size; at += 1) out[at] = list[order[at] as number];
  return out;
}

/** Numbers compare as numbers; anything else compares as its text. */
function compare(left: unknown, right: unknown): number {
  if (typeof left === "number" && typeof right === "number") return left - right;
  const a = String(left);
  const b = String(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

function best(
  list: readonly unknown[],
  scoreOf: (item: unknown, i: number) => number,
  direction: number,
): unknown {
  let winner: unknown = null;
  let score = Number.NaN;
  list.forEach((item, index) => {
    const value = scoreOf(item, index);
    if (Number.isNaN(score) || (value - score) * direction > 0) {
      winner = item;
      score = value;
    }
  });
  return winner;
}

function flatten(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}
