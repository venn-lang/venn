import { truthy } from "../../value/index.js";
import { counted, countedOr } from "../counted-argument.js";
import type { Counted } from "../counted-argument.types.js";
import { type Invoke, type Method, nativeFn } from "../native.types.js";
import { isWaiting } from "../pending.js";
import { sortedBy } from "./list-sorting.js";
import { perItem } from "./over-items.js";

const FROM: Counted = { verb: "slice", what: "position to start at", least: 0 };
const TO: Counted = { verb: "slice", what: "position to stop at", least: 0 };

/** How `sort` orders when given no comparator: numbers by value, else by text. */
function compare(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

const at = (list: readonly unknown[], index: number): unknown => list[index] ?? null;

/** Methods on a list value. Every one is pure and returns a new value. */
export const LIST_METHODS: Record<string, Method> = {
  len: (list: readonly unknown[]) => list.length,
  first: (list: readonly unknown[]) => at(list, 0),
  last: (list: readonly unknown[]) => at(list, list.length - 1),
  map: perItem((_list, results) => results),
  filter: perItem((list, verdicts) => list.filter((_item, index) => truthy(verdicts[index]))),
  reduce: (list: readonly unknown[], invoke: Invoke) =>
    nativeFn((args) =>
      folded(list, args[1], (acc, item, index) => invoke.three(args[0], acc, item, index)),
    ),
  forEach: perItem(() => null),
  find: perItem((list, verdicts) => list.find((_item, index) => truthy(verdicts[index])) ?? null),
  some: perItem((_list, verdicts) => verdicts.some(truthy)),
  every: perItem((_list, verdicts) => verdicts.every(truthy)),
  contains: (list: readonly unknown[]) => nativeFn((args) => list.includes(args[0])),
  indexOf: (list: readonly unknown[]) => nativeFn((args) => list.indexOf(args[0])),
  reverse: (list: readonly unknown[]) => [...list].reverse(),
  flatten: (list: readonly unknown[]) => list.flat(),
  join: (list: readonly unknown[]) =>
    nativeFn((args) => list.map(String).join(args[0] === undefined ? "," : String(args[0]))),
  sort: (list: readonly unknown[], invoke: Invoke) =>
    nativeFn((args) =>
      args[0] ? sortedBy(list, (a, b) => invoke.two(args[0], a, b)) : [...list].sort(compare),
    ),
  // Clamping is deliberate and stays: `xs.slice(1, 99)` asking past the end is
  // how a caller says "from here on", and every language answers what is there.
  // What is refused is a position that is not one, since `-1` used to mean "one
  // from the end" by accident of the host, and this language spells that
  // `takeLast`.
  slice: (list: readonly unknown[]) =>
    nativeFn((args) => list.slice(counted(args[0], FROM), countedOr(args[1], list.length, TO))),
  concat: (list: readonly unknown[]) =>
    nativeFn((args) => [...list, ...(Array.isArray(args[0]) ? args[0] : [args[0]])]),
  push: (list: readonly unknown[]) => nativeFn((args) => [...list, ...args]),
};

/** One step of a fold: what has been folded so far, and the item to fold in. */
type Step = (acc: unknown, item: unknown, index: number) => unknown;

/**
 * Fold from the left, waiting for an accumulator that has not arrived.
 *
 * This is the one verb that cannot gather its results: the accumulator is what
 * the next step is handed, so a step still on its way has to settle before the
 * step after it runs at all. The loop runs straight through while the steps
 * answer at once, and chains from the first one that does not, picking up at
 * the item it stopped on.
 */
function folded(list: readonly unknown[], seed: unknown, step: Step): unknown {
  const carry = (acc: unknown, from: number): unknown => {
    let carried = acc;
    for (let at = from; at < list.length; at += 1) {
      if (isWaiting(carried)) return carried.then((settled) => carry(settled, at));
      carried = step(carried, list[at], at);
    }
    return carried;
  };
  return carry(seed, 0);
}
