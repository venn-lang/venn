import { type Invoke, type Method, nativeFn } from "../native.types.js";

type Dict = Record<string, unknown>;

/** Reshaping a map without a loop: rename, project, combine, walk a path. */
export const MAP_EXTRAS: Record<string, Method> = {
  mapValues: (map: Dict, invoke: Invoke) =>
    nativeFn((args) => rebuild(map, ([k, v]) => [k, invoke.two(args[0], v, k)])),
  mapKeys: (map: Dict, invoke: Invoke) =>
    nativeFn((args) => rebuild(map, ([k, v]) => [String(invoke.two(args[0], k, v)), v])),
  filterValues: (map: Dict, invoke: Invoke) =>
    nativeFn((args) => keepIf(map, ([k, v]) => Boolean(invoke.two(args[0], v, k)))),
  pick: (map: Dict) => nativeFn((args) => keepIf(map, ([k]) => names(args).includes(k))),
  omit: (map: Dict) => nativeFn((args) => keepIf(map, ([k]) => !names(args).includes(k))),
  mergeDeep: (map: Dict) => nativeFn((args) => mergeDeep(map, asDict(args[0]))),
  invert: (map: Dict) => rebuild(map, ([k, v]) => [String(v), k]),
  isEmpty: (map: Dict) => Object.keys(map).length === 0,
  /** `getPath("a.b.c")` reaches into nested data without a chain of guards. */
  getPath: (map: Dict) => nativeFn((args) => walk(map, String(args[0] ?? ""))),
  /** Whether the path leads anywhere, including to a field holding `null`. */
  hasPath: (map: Dict) => nativeFn((args) => reach(map, String(args[0] ?? "")) !== ABSENT),
};

/**
 * The inverse of `entries`: `fromEntries([["a", 1]])` gives `{ a: 1 }`.
 *
 * Built with `Object.fromEntries`, like `rebuild` and `keepIf` below, because
 * it defines each key rather than writing to it. A pair naming `__proto__`
 * comes out of the data, and writing it would have run the inherited setter and
 * replaced what the new map inherits from instead of storing anything. That
 * name is refused as a place to write to (VN3023); as a pair's key it names a
 * value, so it is kept.
 */
export function fromEntries(list: readonly unknown[]): Dict {
  return Object.fromEntries(
    list.filter(isPair).map((pair): [string, unknown] => [String(pair[0]), pair[1]]),
  );
}

/** A pair to make a field from. Anything else in the list names no key. */
function isPair(entry: unknown): entry is readonly unknown[] {
  return Array.isArray(entry) && entry.length > 0;
}

function rebuild(map: Dict, step: (entry: [string, unknown]) => [string, unknown]): Dict {
  return Object.fromEntries(Object.entries(map).map(step));
}

function keepIf(map: Dict, keep: (entry: [string, unknown]) => boolean): Dict {
  return Object.fromEntries(Object.entries(map).filter(keep));
}

/** Flatten the argument list: `pick("a", "b")` and `pick(["a", "b"])` both work. */
function names(args: readonly unknown[]): string[] {
  return args.flatMap((arg) => (Array.isArray(arg) ? arg : [arg])).map(String);
}

/**
 * Merged on a tray with nothing above it, so a branch named `__proto__`,
 * `constructor` or `prototype` is read back and written like any other.
 */
function mergeDeep(left: Dict, right: Dict): Dict {
  const out: Dict = Object.assign(Object.create(null), left);
  for (const [key, value] of Object.entries(right)) {
    const current = out[key];
    out[key] = isDict(current) && isDict(value) ? mergeDeep(current, value) : value;
  }
  return { ...out };
}

/** Nothing at all is here, told apart from a field that holds nothing. */
const ABSENT = Symbol("venn.absent");

/**
 * Follow a dotted path, answering {@link ABSENT} when it leads nowhere.
 *
 * A field holding `null` and a field that does not exist are different facts,
 * and collapsing them made `hasPath` answer `false` for a key that was plainly
 * there.
 */
function reach(map: Dict, path: string): unknown {
  let current: unknown = map;
  for (const part of path.split(".")) {
    if (!isDict(current) && !Array.isArray(current)) return ABSENT;
    if (!Object.hasOwn(current as Dict, part)) return ABSENT;
    current = (current as Dict)[part];
  }
  return current;
}

function walk(map: Dict, path: string): unknown {
  const found = reach(map, path);
  return found === ABSENT ? null : (found ?? null);
}

function isDict(value: unknown): value is Dict {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asDict(value: unknown): Dict {
  return isDict(value) ? value : {};
}
