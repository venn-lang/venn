import type { TypeContext } from "./context.js";
import {
  BOOL,
  baseOf,
  callback,
  DYNAMIC,
  type FnType,
  fn,
  list,
  NUMBER,
  prim,
  type RecordType,
  STRING,
  type Type,
  type TypeVar,
  type UnionType,
  union,
} from "./type.types.js";
import { prune } from "./unify.js";

/**
 * The type of a built-in member: a property such as `length`, or a generic
 * method such as `map`.
 *
 * These are where generics earn their keep. `list<T>.map` is
 * `fn(fn(T, number) -> U) -> list<U>`, with a fresh `U` per use.
 *
 * @returns undefined when the receiver's type has no such member, so the caller
 * can fall back to a record field or to `dynamic`.
 */
export function memberType(receiver: Type, name: string, ctx: TypeContext): Type | undefined {
  const t = prune(receiver);
  if (t.kind === "list") return listMember(t.element, name, ctx);
  if (t.kind === "literal") return memberType(prim(baseOf(t.value)), name, ctx);
  if (t.kind === "union") return unionMember(t, name, ctx);
  if (t.kind === "prim" && t.name === "string") return stringMember(name);
  if (t.kind === "prim" && t.name === "number") return numberMember(name);
  if (t.kind === "record") return recordMember(t, name);
  if (t.kind === "prim") return unitMember(t.name, name);
  // A handle answers to what it published, and to nothing else: its inside is
  // none of the reader's business, which is what makes it opaque.
  if (t.kind === "opaque") return t.members?.get(name);
  return undefined;
}

/**
 * A member of a union is a member of every branch, or of none.
 *
 * Offering what only one branch has would be a lie the moment the value is the
 * other one.
 */
function unionMember(type: UnionType, name: string, ctx: TypeContext): Type | undefined {
  const found = type.members.map((member) => memberType(member, name, ctx));
  if (found.some((member) => member === undefined)) return undefined;
  return union(found as Type[]);
}

const DURATION: Type = { kind: "prim", name: "duration" };
const SIZE: Type = { kind: "prim", name: "size" };
const PERCENT: Type = { kind: "prim", name: "percent" };

/**
 * Reading a unit back as a plain number, in whichever unit you want it. The unit
 * exists to keep `300ms + 2mb` from type-checking; once you are printing or
 * comparing against raw data, these are the way across.
 */
const UNIT_MEMBERS: Record<string, Record<string, Type>> = {
  duration: { ms: NUMBER, seconds: NUMBER, minutes: NUMBER, hours: NUMBER },
  size: { bytes: NUMBER, kb: NUMBER, mb: NUMBER, gb: NUMBER },
  percent: { ratio: NUMBER, percent: NUMBER, of: fn([NUMBER], NUMBER) },
};

function unitMember(unit: string, name: string): Type | undefined {
  return UNIT_MEMBERS[unit]?.[name];
}

function listMember(element: Type, name: string, ctx: TypeContext): Type | undefined {
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
    flatten: () => list(DYNAMIC),
    isEmpty: () => BOOL,
    sum: () => NUMBER,
    average: () => NUMBER,
    min: () => NUMBER,
    max: () => NUMBER,
    toMap: () => DYNAMIC,
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
    // Grouping changes the shape: a list becomes a map, or a list of lists.
    groupBy: () => fn([over(DYNAMIC)], DYNAMIC),
    countBy: () => fn([over(DYNAMIC)], DYNAMIC),
    keyBy: () => fn([over(DYNAMIC)], DYNAMIC),
    partition: () => fn([predicate], list(self)),
    chunk: () => fn([NUMBER], list(self)),
    windows: () => fn([NUMBER], list(self)),
    pairwise: () => list(self),
    zip: () => fn([list(DYNAMIC)], list(list(DYNAMIC))),
    unzip: () => list(list(DYNAMIC)),
    map: () => mapType(over, u()),
    filter: () => fn([predicate], list(element)),
    find: () => fn([predicate], element),
    some: () => fn([predicate], BOOL),
    every: () => fn([predicate], BOOL),
    forEach: () => fn([over(DYNAMIC)], NULL_VOID),
    reduce: () => reduceType(element, u(), NUMBER),
    contains: () => fn([element], BOOL),
    indexOf: () => fn([element], NUMBER),
    join: () => fn([STRING], STRING),
    sort: () => fn([fn([element, element], NUMBER)], list(element)),
    slice: () => fn([NUMBER, NUMBER], list(element)),
    concat: () => fn([list(element)], list(element)),
    push: () => fn([element], list(element)),
  };
  return table[name]?.();
}

const NULL_VOID = { kind: "prim", name: "null" } as const;

/** The callback shape a list method hands its element to. */
type Over = (result: Type) => FnType;

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

function stringMember(name: string): Type | undefined {
  const table: Record<string, Type> = {
    len: NUMBER,
    upper: STRING,
    lower: STRING,
    trim: STRING,
    reverse: STRING,
    toNumber: NUMBER,
    split: fn([STRING], list(STRING)),
    replace: fn([STRING, STRING], STRING),
    contains: fn([STRING], BOOL),
    startsWith: fn([STRING], BOOL),
    endsWith: fn([STRING], BOOL),
    slice: fn([NUMBER, NUMBER], STRING),
    repeat: fn([NUMBER], STRING),
    padStart: fn([NUMBER, STRING], STRING),
    padEnd: fn([NUMBER, STRING], STRING),
    indexOf: fn([STRING], NUMBER),
    words: list(STRING),
    lines: list(STRING),
    chars: list(STRING),
    capitalize: STRING,
    title: STRING,
    slugify: STRING,
    isEmpty: BOOL,
    isBlank: BOOL,
    trimStart: STRING,
    trimEnd: STRING,
    count: fn([STRING], NUMBER),
    matches: fn([STRING], list(STRING)),
    test: fn([STRING], BOOL),
    before: fn([STRING], STRING),
    after: fn([STRING], STRING),
    ensureStart: fn([STRING], STRING),
    ensureEnd: fn([STRING], STRING),
  };
  return table[name];
}

function numberMember(name: string): Type | undefined {
  const table: Record<string, Type> = {
    abs: NUMBER,
    floor: NUMBER,
    ceil: NUMBER,
    sign: NUMBER,
    sqrt: NUMBER,
    isEven: BOOL,
    isOdd: BOOL,
    round: fn([NUMBER], NUMBER),
    toFixed: fn([NUMBER], STRING),
    clamp: fn([NUMBER, NUMBER], NUMBER),
    pow: fn([NUMBER], NUMBER),
    times: list(NUMBER),
    toString: STRING,
  };
  return table[name] ?? TO_UNIT[name];
}

/**
 * Reading a plain number as a unit, the way back from {@link UNIT_MEMBERS}. For
 * every `X` a unit answers to, a number answers to `toX`.
 */
const TO_UNIT: Record<string, Type> = {
  toMs: DURATION,
  toSeconds: DURATION,
  toMinutes: DURATION,
  toHours: DURATION,
  toBytes: SIZE,
  toKb: SIZE,
  toMb: SIZE,
  toGb: SIZE,
  toRatio: PERCENT,
  toPercent: PERCENT,
};

function recordMember(receiver: RecordType, name: string): Type | undefined {
  const table: Record<string, Type> = {
    keys: list(STRING),
    values: list(DYNAMIC),
    entries: list(DYNAMIC),
    len: NUMBER,
    has: fn([STRING], BOOL),
    get: fn([STRING], DYNAMIC),
    merge: fn([DYNAMIC], DYNAMIC),
    mergeDeep: fn([DYNAMIC], DYNAMIC),
    // A map's callbacks are handed the key alongside the value, or the other
    // way round for `mapKeys`. Taking the second one is optional.
    mapValues: fn([callback([DYNAMIC, STRING], DYNAMIC, 1)], DYNAMIC),
    mapKeys: fn([callback([STRING, DYNAMIC], STRING, 1)], DYNAMIC),
    filterValues: fn([callback([DYNAMIC, STRING], BOOL, 1)], DYNAMIC),
    pick: fn([STRING], DYNAMIC),
    omit: fn([STRING], DYNAMIC),
    invert: DYNAMIC,
    isEmpty: BOOL,
    getPath: fn([STRING], DYNAMIC),
    hasPath: fn([STRING], BOOL),
  };
  return receiver.fields.has(name) ? undefined : table[name];
}

/**
 * A member as the language reads it: the built-in when there is one, otherwise
 * the field the map carries.
 *
 * {@link memberType} alone stops at built-ins so inference can report an unknown
 * field. Tooling wants the answer, not the distinction.
 */
export function resolveMember(receiver: Type, name: string, ctx: TypeContext): Type | undefined {
  const built = memberType(receiver, name, ctx);
  if (built) return built;
  const t = prune(receiver);
  return t.kind === "record" ? t.fields.get(name) : undefined;
}
