import { truthy } from "../../value/index.js";
import { counted, countedOr } from "../counted-argument.js";
import type { Counted } from "../counted-argument.types.js";
import { type Invoke, type Method, nativeFn } from "../native.types.js";

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
  map: (list: readonly unknown[], invoke: Invoke) =>
    nativeFn((args) => list.map((item, i) => invoke.two(args[0], item, i))),
  filter: (list: readonly unknown[], invoke: Invoke) =>
    nativeFn((args) => list.filter((item, i) => truthy(invoke.two(args[0], item, i)))),
  reduce: (list: readonly unknown[], invoke: Invoke) =>
    nativeFn((args) => list.reduce((acc, item, i) => invoke.three(args[0], acc, item, i), args[1])),
  forEach: (list: readonly unknown[], invoke: Invoke) =>
    nativeFn((args) => {
      list.forEach((item, i) => {
        invoke.two(args[0], item, i);
      });
      return null;
    }),
  find: (list: readonly unknown[], invoke: Invoke) =>
    nativeFn((args) => list.find((item, i) => truthy(invoke.two(args[0], item, i))) ?? null),
  some: (list: readonly unknown[], invoke: Invoke) =>
    nativeFn((args) => list.some((item, i) => truthy(invoke.two(args[0], item, i)))),
  every: (list: readonly unknown[], invoke: Invoke) =>
    nativeFn((args) => list.every((item, i) => truthy(invoke.two(args[0], item, i)))),
  contains: (list: readonly unknown[]) => nativeFn((args) => list.includes(args[0])),
  indexOf: (list: readonly unknown[]) => nativeFn((args) => list.indexOf(args[0])),
  reverse: (list: readonly unknown[]) => [...list].reverse(),
  flatten: (list: readonly unknown[]) => list.flat(),
  join: (list: readonly unknown[]) =>
    nativeFn((args) => list.map(String).join(args[0] === undefined ? "," : String(args[0]))),
  sort: (list: readonly unknown[], invoke: Invoke) =>
    nativeFn((args) =>
      args[0]
        ? [...list].sort((a, b) => Number(invoke.two(args[0], a, b)))
        : [...list].sort(compare),
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
