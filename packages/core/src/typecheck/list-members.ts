import { createContext, type TypeContext } from "./context.js";
import { declared } from "./declared.js";
import {
  BOOL,
  callback,
  DYNAMIC,
  type FnType,
  fn,
  list,
  mapOf,
  NUMBER,
  optional,
  positional,
  STRING,
  type Type,
  type TypeVar,
  union,
  variadic,
} from "./type.types.js";
import { prune } from "./unify.js";

const NULL_VOID: Type = { kind: "prim", name: "null" };

/** The callback shape a list method hands its element to. */
type Over = (result: Type) => FnType;

/**
 * What a `list<T>` answers to, with `T` carried through.
 *
 * These are where generics earn their keep: `map` is
 * `fn(fn(T, number) -> U) -> list<U>` with a fresh `U` per use, and grouping
 * turns a list into a `map<list<T>>` rather than into `dynamic`.
 *
 * @param element The element type, `T`.
 * @param name The member being read.
 * @param ctx Where fresh variables come from.
 * @returns undefined when a list has no such member.
 */
export function listMember(element: Type, name: string, ctx: TypeContext): Type | undefined {
  return declared(listTable(element, ctx), name)?.();
}

/**
 * Every member a list answers to, the names alone.
 *
 * Taken from the table that answers them rather than written out again, since
 * two lists of the same names are two lists that drift.
 * `value/member-tables-agree.test.ts` holds this against the runtime's table
 * and the editor's docs.
 */
export const LIST_MEMBER_NAMES: readonly string[] = Object.keys(
  listTable(DYNAMIC, createContext()),
);

function listTable(element: Type, ctx: TypeContext): Record<string, () => Type> {
  const u = (): TypeVar => ctx.fresh();
  const self = list(element);
  /** Every list callback is handed the index too; `p => p.age` may ignore it. */
  const over = (result: Type): FnType => callback([element, NUMBER], result, 1);
  const predicate = over(BOOL);
  const table: Record<string, () => Type> = {
    len: () => NUMBER,
    first: () => element,
    last: () => element,
    reverse: () => self,
    flatten: () => list(flattened(element)),
    isEmpty: () => BOOL,
    sum: () => NUMBER,
    average: () => NUMBER,
    min: () => NUMBER,
    max: () => NUMBER,
    // `[["a", 1]].toMap` reads the pairs back: a list is one type throughout, so
    // the key and the value are both whatever the pair holds.
    toMap: () => mapOf(flattened(element)),
    // Selecting keeps the element type; only the shape of the result changes.
    take: () => fn([NUMBER], self),
    drop: () => fn([NUMBER], self),
    takeLast: () => fn([NUMBER], self),
    dropLast: () => fn([NUMBER], self),
    takeWhile: () => fn([predicate], self),
    dropWhile: () => fn([predicate], self),
    distinct: () => self,
    distinctBy: () => fn([over(u())], self),
    sortBy: () => fn([over(u())], self),
    minBy: () => fn([over(NUMBER)], element),
    maxBy: () => fn([over(NUMBER)], element),
    sumBy: () => fn([over(NUMBER)], NUMBER),
    flatMap: () => flatMapType(over, u()),
    // Grouping changes the shape: a list becomes a map, or a list of lists. The
    // key is whatever the callback returns, read back as the name of a key.
    groupBy: () => fn([over(u())], mapOf(self)),
    countBy: () => fn([over(u())], mapOf(NUMBER)),
    keyBy: () => fn([over(u())], mapOf(element)),
    partition: () => fn([predicate], list(self)),
    chunk: () => fn([NUMBER], list(self)),
    windows: () => fn([NUMBER], list(self)),
    pairwise: () => list(positional(element, [element, element])),
    zip: () => zipType(element, u()),
    unzip: () => list(list(flattened(element))),
    map: () => mapType(over, u()),
    filter: () => fn([predicate], list(element)),
    find: () => fn([predicate], element),
    some: () => fn([predicate], BOOL),
    every: () => fn([predicate], BOOL),
    forEach: () => fn([over(u())], NULL_VOID),
    reduce: () => reduceType(element, u(), NUMBER),
    contains: () => fn([element], BOOL),
    indexOf: () => fn([element], NUMBER),
    join: () => fn([STRING], STRING),
    // Sorted by the natural order of the elements unless told otherwise.
    sort: () => optional([fn([element, element], NUMBER)], list(element), 0),
    slice: () => optional([NUMBER, NUMBER], list(element), 1),
    concat: () => fn([list(element)], list(element)),
    // As many as you like, and every one of them an element: the run appends
    // them all, and a signature of exactly one was refusing what it accepts.
    push: () => variadic([element], list(element)),
  };
  return table;
}

/**
 * One level off: `list<list<T>>` flattens to `list<T>`, and anything that is not
 * a list passes through as itself, which is what `.flat()` does to it.
 */
function flattened(element: Type): Type {
  const t = prune(element);
  if (t.kind === "list") return t.element;
  if (t.kind === "union") return union(t.members.map(flattened));
  return t;
}

/**
 * `[1, 2].zip(["a"])` gives `[[1, "a"]]`: pairs of one side and the other.
 *
 * The element stays the union, so the type reads and fits as it always has, and
 * the positions say which side each half came from.
 */
function zipType(element: Type, other: Type): Type {
  const pair = positional(union([element, other]), [element, other]);
  return fn([list(other)], list(pair));
}

function mapType(over: Over, into: Type): Type {
  return fn([over(into)], list(into));
}

function flatMapType(over: Over, into: Type): Type {
  return fn([over(list(into))], list(into));
}

/** `reduce` hands over the running total, the item, and the index. */
function reduceType(element: Type, acc: Type, index: Type): Type {
  return fn([callback([acc, element, index], acc, 2), acc], acc);
}
