import { counted } from "../counted-argument.js";
import type { Counted } from "../counted-argument.types.js";
import { type Method, nativeFn } from "../native.types.js";
import { perItem } from "./over-items.js";

type Dict = Record<string, unknown>;

/** Both cut a list into runs, and a run of nothing is not a run. */
const CHUNK: Counted = { verb: "chunk", what: "chunk size", least: 1 };
const WINDOWS: Counted = { verb: "windows", what: "window size", least: 1 };

/**
 * A grouping key: what `groupBy`, `countBy` and `keyBy` file an item under.
 *
 * A number or a boolean converts directly; only a shape is serialised. Passing
 * scalars through `JSON.stringify` would be both slower and wrong, since it
 * renders `Infinity` and `NaN` as `null` and would file them alongside items
 * whose key genuinely is null.
 */
function key(value: unknown): string {
  const kind = typeof value;
  if (kind === "string") return value as string;
  if (kind === "number" || kind === "boolean") return String(value);
  // `JSON.stringify` answers `undefined` (not a string) for undefined and for a
  // function, so anything it cannot render is named rather than cast.
  return JSON.stringify(value) ?? String(value);
}

/**
 * The operations that are a chore to hand-roll everywhere else: grouping,
 * partitioning, keying, counting. Each returns a new value and never mutates.
 */
export const LIST_GROUPING: Record<string, Method> = {
  groupBy: perItem((list, keys) => group(list, (at) => key(keys[at]))),
  countBy: perItem((list, keys) => counts(list, (at) => key(keys[at]))),
  keyBy: perItem((list, keys) => keyed(list, (at) => key(keys[at]))),
  partition: perItem((list, verdicts) => split(list, (at) => Boolean(verdicts[at]))),
  chunk: (list: readonly unknown[]) => nativeFn((args) => chunk(list, counted(args[0], CHUNK))),
  windows: (list: readonly unknown[]) =>
    nativeFn((args) => windows(list, counted(args[0], WINDOWS))),
  pairwise: (list: readonly unknown[]) => windows(list, 2),
  zip: (list: readonly unknown[]) => nativeFn((args) => zip(list, asList(args[0]))),
  unzip: (list: readonly unknown[]) => unzip(list),
};

/**
 * An accumulator with nothing above it, handed back as an everyday map.
 *
 * The key these three file an item under comes out of the data: a JSON field, a
 * header, a form value. On an ordinary object that key is not just a key.
 * Reading `out["constructor"]` answers `Object` rather than "no group yet", so
 * the first item was appended to a function and the spread threw a host
 * `TypeError` with no code and no span; writing `out["__proto__"]` runs an
 * inherited setter and swaps what the accumulator inherits from, so the group
 * vanished and every later read of it went the same way. With no prototype
 * there is nothing to inherit and no setter to run, so every name behaves like
 * every other name.
 *
 * These three names are refused as assignment TARGETS (VN3023), because
 * `m["__proto__"] = 1` names a place belonging to what made the map. A
 * grouping key names a value, not a place, so here it is kept.
 */
function tray(): Dict {
  return Object.create(null) as Dict;
}

function group(list: readonly unknown[], keyOf: (index: number) => string): Dict {
  const out = tray();
  list.forEach((item, index) => {
    const name = keyOf(index);
    out[name] = [...((out[name] as unknown[]) ?? []), item];
  });
  return { ...out };
}

function counts(list: readonly unknown[], keyOf: (index: number) => string): Dict {
  const out = tray();
  list.forEach((_item, index) => {
    const name = keyOf(index);
    out[name] = Number(out[name] ?? 0) + 1;
  });
  return { ...out };
}

/** Like `groupBy`, but the last item under a key wins: an index, not buckets. */
function keyed(list: readonly unknown[], keyOf: (index: number) => string): Dict {
  const out = tray();
  list.forEach((item, index) => {
    out[keyOf(index)] = item;
  });
  return { ...out };
}

function split(list: readonly unknown[], keep: (index: number) => boolean): unknown[][] {
  const yes: unknown[] = [];
  const no: unknown[] = [];
  list.forEach((item, index) => {
    (keep(index) ? yes : no).push(item);
  });
  return [yes, no];
}

function chunk(list: readonly unknown[], size: number): unknown[][] {
  const out: unknown[][] = [];
  for (let index = 0; index < list.length; index += size) out.push(list.slice(index, index + size));
  return out;
}

/** Every consecutive run of `size` items: `[1,2,3].windows(2)` gives `[[1,2],[2,3]]`. */
function windows(list: readonly unknown[], size: number): unknown[][] {
  const out: unknown[][] = [];
  for (let index = 0; index + size <= list.length; index += 1) {
    out.push(list.slice(index, index + size));
  }
  return out;
}

/**
 * Pairs of one list and the other, stopping at the shorter.
 *
 * Deliberately total, and the one truncation in this file that stays. Zipping
 * two lists of different lengths is the ordinary case, not the mistake:
 * `names.zip(scores)` where one is short is how a caller asks for the overlap,
 * and Python, Rust, Kotlin and Swift all answer the overlap. What the shorter
 * one holds is a question about the caller's data, not about `zip`. Ask
 * `a.len == b.len` where the lengths are supposed to match.
 */
function zip(list: readonly unknown[], other: readonly unknown[]): unknown[][] {
  return list.slice(0, Math.min(list.length, other.length)).map((item, i) => [item, other[i]]);
}

function unzip(list: readonly unknown[]): unknown[][] {
  const pairs = list.map((item) => (Array.isArray(item) ? item : [item]));
  const width = pairs.reduce((most, pair) => Math.max(most, pair.length), 0);
  return Array.from({ length: width }, (_column, index) => pairs.map((pair) => pair[index]));
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
