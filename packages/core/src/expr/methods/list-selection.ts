import { truthy } from "../../value/index.js";
import { noNumericAnswer, notACount, notANumber } from "../argument-refusal.js";
import { counted } from "../counted-argument.js";
import type { Counted } from "../counted-argument.types.js";
import { type Invoke, type Method, nativeFn } from "../native.types.js";
import { fromEntries } from "./map-extras.js";

/**
 * A value being added up or compared, which has to be a number.
 *
 * `Number(value)` was here, and it turns a word into `NaN`: one bad row in a
 * file made `rows.sum` `NaN`, every comparison against it false, and the report
 * plausible. The checker refuses `["a"].sum` on the signature, so what arrives
 * here came through a `dynamic`, which is exactly where the bad row comes from.
 */
const num = (value: unknown, verb: string): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const at = { verb, what: "number", least: 0 };
  throw typeof value === "number" ? notACount(value, at) : notANumber(value, at);
};

/** Four verbs asking the same question, so they ask it in the same words. */
const aCount = (verb: string): Counted => ({ verb, what: "count", least: 0 });

const TAKE = aCount("take");
const DROP = aCount("drop");
const TAKE_LAST = aCount("takeLast");
const DROP_LAST = aCount("dropLast");

/** Selecting, ordering and summarising: the other half of everyday list work. */
export const LIST_SELECTION: Record<string, Method> = {
  take: (list: readonly unknown[]) => nativeFn((args) => list.slice(0, counted(args[0], TAKE))),
  drop: (list: readonly unknown[]) => nativeFn((args) => list.slice(counted(args[0], DROP))),
  // Counted from the front, because `slice(-0)` is `slice(0)` and would hand
  // back the whole list when asked for none of it.
  takeLast: (list: readonly unknown[]) =>
    nativeFn((args) => list.slice(Math.max(0, list.length - counted(args[0], TAKE_LAST)))),
  dropLast: (list: readonly unknown[]) =>
    nativeFn((args) => list.slice(0, Math.max(0, list.length - counted(args[0], DROP_LAST)))),
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
    nativeFn((args) => best(list, (item, i) => num(invoke.two(args[0], item, i), "minBy"), -1)),
  maxBy: (list: readonly unknown[], invoke: Invoke) =>
    nativeFn((args) => best(list, (item, i) => num(invoke.two(args[0], item, i), "maxBy"), 1)),
  sumBy: (list: readonly unknown[], invoke: Invoke) =>
    nativeFn((args) =>
      list.reduce((total: number, x, i) => total + num(invoke.two(args[0], x, i), "sumBy"), 0),
    ),
  flatMap: (list: readonly unknown[], invoke: Invoke) =>
    nativeFn((args) => list.flatMap((item, i) => flatten(invoke.two(args[0], item, i)))),
  sum: (list: readonly unknown[]) => list.reduce((total: number, x) => total + num(x, "sum"), 0),
  average: (list: readonly unknown[]) => average(list),
  // Folded rather than spread: `Math.min(...list)` passes every element as an
  // argument, and a list of a few hundred thousand overflows the call stack.
  min: (list: readonly unknown[]) => extreme(list, -1, "min"),
  max: (list: readonly unknown[]) => extreme(list, 1, "max"),
  /** The inverse of a map's `entries`: `[["a", 1]].toMap` gives `{ a: 1 }`. */
  toMap: (list: readonly unknown[]) => fromEntries(list),
  isEmpty: (list: readonly unknown[]) => list.length === 0,
};

/**
 * The mean, or a refusal when there is nothing to take the mean of.
 *
 * Zero was the old answer and it is a plausible one, which is the trouble: a
 * report of no rows read as a day when everything was free rather than as a day
 * with no rows. `sum` keeps answering zero, because zero really is the sum of
 * nothing.
 *
 * The help names `try` rather than a guard block for the reason the divisor's
 * does: a binding declared inside `if xs.len > 0 { … }` is out of scope on the
 * line that reads it, so the rewrite would answer `null` and exit 0.
 */
function average(list: readonly unknown[]): number {
  if (list.length === 0)
    throw noNumericAnswer(
      "There is no average of an empty list.",
      "Give it a stand-in with `try xs.average else 0`, or ask whether there is anything first.",
    );
  return list.reduce((total: number, x) => total + num(x, "average"), 0) / list.length;
}

/**
 * The smallest or largest number in a list, or null when there is none.
 *
 * Nothing is what an empty list holds the extreme of, and null is how this
 * language says nothing. A `NaN` in the middle used to escape as the answer;
 * now `num` refuses the element that is not a number, at the element.
 */
function extreme(list: readonly unknown[], direction: 1 | -1, verb: string): number | null {
  if (list.length === 0) return null;
  let best = num(list[0], verb);
  for (let at = 1; at < list.length; at += 1) {
    const value = num(list[at], verb);
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
