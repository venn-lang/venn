/**
 * A static type. `dynamic` is the escape hatch for the result of a plugin
 * action, an HTTP response, `json`: anything the checker cannot know. It unifies
 * with everything and never produces an error, so the effectful world places no
 * annotation burden on the pure one.
 */
export type Type =
  | PrimType
  | ExactType
  | ListType
  | RecordType
  | FnType
  | UnionType
  | OpaqueType
  | DynamicType
  | TypeVar;

export type PrimName =
  | "number"
  | "string"
  | "bool"
  | "null"
  | "void"
  | "duration"
  | "size"
  | "percent"
  | "instant";

export interface PrimType {
  readonly kind: "prim";
  readonly name: PrimName;
}

/** One value, standing for itself: `"GET"`, `200`, `true`. */
export interface ExactType {
  readonly kind: "literal";
  readonly value: string | number | boolean;
}

export interface ListType {
  readonly kind: "list";
  readonly element: Type;
  /**
   * What each position holds, for a list whose layout is settled: the pair
   * `entries`, `zip` and `pairwise` hand back, and nothing else.
   *
   * There is no tuple here, so `element` stays the union a reader sees and every
   * message prints. This says which member position 0 really is, which is the
   * difference between `e[1]` being a number and being either of two things.
   */
  readonly positions?: readonly Type[];
}

/** One of several. What makes `"GET" | "POST"` more than a string. */
export interface UnionType {
  readonly kind: "union";
  readonly members: readonly Type[];
}

/**
 * A handle with a name and no visible inside: a server, a browser, a connection.
 *
 * This is the border with the world outside. Whatever a JavaScript class really
 * is, it arrives here as a name its own namespace's verbs understand and nothing
 * else can open, which keeps the object graph of another language out of this
 * one.
 */
export interface OpaqueType {
  readonly kind: "opaque";
  readonly name: string;
  /** What it publishes. Absent means a name and nothing more. */
  readonly members?: ReadonlyMap<string, Type>;
}

/** A map/object with known fields. `open` records tolerate extra fields. */
export interface RecordType {
  readonly kind: "record";
  readonly fields: ReadonlyMap<string, Type>;
  readonly open: boolean;
  /**
   * What a key nobody listed holds: `Record<string, string>` written as a type.
   * Without it an open record answers `dynamic` for everything it did not name,
   * which is right for a loose map and wrong for `headers`.
   */
  readonly rest?: Type;
}

/** A function: what it takes, what it gives back, and how strictly it is called. */
export interface FnType {
  readonly kind: "fn";
  readonly params: readonly Type[];
  readonly result: Type;
  /** Takes any number of arguments, as `str(a, b, c)` and `range(1, 4)` do. Its
   * params describe the shape it accepts, not a count to enforce. */
  readonly variadic?: boolean;
  /** Params from this index on are handed over but may be ignored: `map` offers
   * the index to a callback that is free to take only the item. */
  readonly ignorableFrom?: number;
}

export interface DynamicType {
  readonly kind: "dynamic";
}

/** A unification variable. `ref` is filled in as inference solves it. */
export interface TypeVar {
  readonly kind: "var";
  readonly id: number;
  ref: Type | undefined;
}

/** The one `dynamic`. Shared, since it carries no state to keep apart. */
export const DYNAMIC: DynamicType = { kind: "dynamic" };

/** One of the language's primitive types, by name. */
export function prim(name: PrimName): PrimType {
  return { kind: "prim", name };
}

export const NUMBER: PrimType = prim("number");
export const STRING: PrimType = prim("string");
export const BOOL: PrimType = prim("bool");
export const NULL: PrimType = prim("null");
export const VOID: PrimType = prim("void");

export function list(element: Type): ListType {
  return { kind: "list", element };
}

/**
 * A pair: a list whose every position is known one by one.
 *
 * The element is passed rather than worked out, because it is what the reader
 * already sees and has to keep seeing. `entries` prints `list<string | number>`
 * either way, and `[1, 2].pairwise` prints `list<list<number>>` only while its
 * element stays the element it started as.
 *
 * @param element What the list holds throughout, for printing, fitting and
 * unifying, all of which know nothing about positions.
 * @param positions What each position holds, in order. Every one of them has to
 * fit `element`, and there have to be as many as the list is long.
 * @returns The list, carrying both answers.
 */
export function positional(element: Type, positions: readonly Type[]): ListType {
  return { kind: "list", element, positions };
}

export function fn(params: readonly Type[], result: Type): FnType {
  return { kind: "fn", params, result };
}

/** A function of any arity, e.g. `str(…)`: only its result is fixed. */
export function variadic(params: readonly Type[], result: Type): FnType {
  return { kind: "fn", params, result, variadic: true };
}

/**
 * A callback that is handed `params` but need only take the first `takes` of
 * them. `list.map` passes the index alongside the item, and `p => p.age` is
 * still a perfectly good argument to it.
 */
export function callback(params: readonly Type[], result: Type, takes: number): FnType {
  return { kind: "fn", params, result, ignorableFrom: takes };
}

/**
 * A function whose last parameters may be left out: `padStart(8)` pads with a
 * space, `padStart(8, ".")` with a dot. The same shape as {@link callback} read
 * from the other side, since a parameter nobody has to pass and one a callback
 * may ignore are the same fact about arity.
 */
export function optional(params: readonly Type[], result: Type, required: number): FnType {
  return { kind: "fn", params, result, ignorableFrom: required };
}

export function record(fields: ReadonlyMap<string, Type>, open = false, rest?: Type): RecordType {
  return rest ? { kind: "record", fields, open, rest } : { kind: "record", fields, open };
}

/** Keys unknown, values all alike: `map<string>`. */
export function mapOf(value: Type): RecordType {
  return record(new Map(), true, value);
}

/** One value standing for itself, as `"GET"` does where a type is written. */
export function literal(value: string | number | boolean): ExactType {
  return { kind: "literal", value };
}

/** A named handle, with the surface it publishes, or a bare name without one. */
export function opaque(name: string, members?: ReadonlyMap<string, Type>): OpaqueType {
  return members ? { kind: "opaque", name, members } : { kind: "opaque", name };
}

/**
 * One of several, with the two that are not really several taken out.
 *
 * A union of one is that one: `string | string` helps nobody read anything. And
 * a union holding `dynamic` is `dynamic`, at every site that builds one, because
 * anything already unknown cannot be made more unknown by adding a member to it.
 * `fits` walks every member of a union, so `dynamic | null` refuses exactly what
 * the `dynamic` was there to allow: a pair element read by position and a
 * caught error's `data` both went through this, from two different mechanisms,
 * which is why it is enforced here rather than at each caller.
 *
 * Members repeat for the same reason: a list gathers its element type item by
 * item, so three numbers made `string | number | number | number` and a reader
 * met all four. Sameness is only asked of the members a reader can tell apart,
 * which is every kind but a solved variable.
 */
export function union(members: readonly Type[]): Type {
  const flat = members.flatMap((m) => (m.kind === "union" ? m.members : [m]));
  if (flat.some((m) => m.kind === "dynamic")) return DYNAMIC;
  const once = distinct(flat);
  return once.length === 1 ? (once[0] as Type) : { kind: "union", members: once };
}

/** The first of each member a reader would read the same way. */
function distinct(members: readonly Type[]): Type[] {
  const seen = new Set<string>();
  const once: Type[] = [];
  for (const member of members) {
    const key = keyOf(member);
    if (key !== undefined && seen.has(key)) continue;
    if (key !== undefined) seen.add(key);
    once.push(member);
  }
  return once;
}

/**
 * How a member reads, where that is plain from the member alone.
 *
 * A shape, a function and a variable answer nothing and are kept: two records
 * with the same fields still print the same, but deciding they are one type is
 * `unify`'s job, and this file cannot ask it without a cycle.
 */
function keyOf(type: Type): string | undefined {
  if (type.kind === "prim") return type.name;
  if (type.kind === "literal") return `${typeof type.value} ${String(type.value)}`;
  if (type.kind === "opaque") return `@${type.name}`;
  if (type.kind !== "list") return undefined;
  const inner = keyOf(type.element);
  return inner === undefined ? undefined : `[${inner}]`;
}

/** Which primitive a literal is one of: `"GET"` is a string, and unifies as one. */
export function baseOf(value: ExactType["value"]): PrimName {
  if (typeof value === "number") return "number";
  return typeof value === "boolean" ? "bool" : "string";
}
