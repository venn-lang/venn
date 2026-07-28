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

/** The inverse of `entries`: `fromEntries([["a", 1]])` gives `{ a: 1 }`. */
export function fromEntries(list: readonly unknown[]): Dict {
  const out: Dict = {};
  for (const entry of list) {
    const pair = Array.isArray(entry) ? entry : [];
    if (pair.length > 0) out[String(pair[0])] = pair[1];
  }
  return out;
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

function mergeDeep(left: Dict, right: Dict): Dict {
  const out: Dict = { ...left };
  for (const [key, value] of Object.entries(right)) {
    const current = out[key];
    out[key] = isDict(current) && isDict(value) ? mergeDeep(current, value) : value;
  }
  return out;
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
