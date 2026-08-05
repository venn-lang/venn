import type {
  ExactType,
  FnType,
  ListType,
  RecordType,
  Type,
  TypeVar,
  UnionType,
} from "./type.types.js";
import { baseOf, DYNAMIC } from "./type.types.js";

/** Follow solved variables to the type they stand for. */
export function prune(type: Type): Type {
  if (type.kind === "var" && type.ref) {
    const resolved = prune(type.ref);
    type.ref = resolved;
    return resolved;
  }
  return type;
}

/**
 * Make two types equal, solving variables along the way.
 *
 * `dynamic` unifies with anything without constraining it. That is the escape
 * hatch keeping the effectful world from forcing annotations.
 *
 * @returns true when they were made equal. Variables solved before a later step
 * failed stay solved, so a false answer is not a rollback.
 */
export function unify(left: Type, right: Type): boolean {
  const a = prune(left);
  const b = prune(right);
  if (a === b) return true;
  if (a.kind === "dynamic" || b.kind === "dynamic") return true;
  if (a.kind === "var") return bind(a, b);
  if (b.kind === "var") return bind(b, a);
  if (a.kind === "union" || b.kind === "union") return unifyUnion(a, b);
  if (a.kind === "literal" || b.kind === "literal") return unifyLiteral(a, b);
  if (a.kind === "opaque" && b.kind === "opaque") return a.name === b.name;
  if (a.kind === "prim" && b.kind === "prim") return a.name === b.name;
  if (a.kind === "list" && b.kind === "list") return unify(a.element, b.element);
  if (a.kind === "fn" && b.kind === "fn") return unifyFn(a, b);
  if (a.kind === "record" && b.kind === "record") return unifyRecord(a, b);
  return false;
}

/** `"GET"` is a string wherever a string is wanted, and itself where it is not. */
function unifyLiteral(a: Type, b: Type): boolean {
  if (a.kind === "literal" && b.kind === "literal") return a.value === b.value;
  const lit: ExactType = a.kind === "literal" ? a : (b as ExactType);
  const other = a.kind === "literal" ? b : a;
  return other.kind === "prim" && other.name === baseOf(lit.value);
}

/**
 * A union is satisfied by any one of its members.
 *
 * Membership is decided by {@link matches}, which never binds a variable: trying
 * a member and rolling back would leave half-solved variables behind, and a
 * checker that guesses wrong is worse than one that stays quiet.
 */
function unifyUnion(a: Type, b: Type): boolean {
  const [set, other] = a.kind === "union" ? [a, b] : [b as UnionType, a];
  if (other.kind === "union") {
    return other.members.every((m) => set.members.some((option) => matches(option, m)));
  }
  return set.members.some((option) => matches(option, other));
}

/**
 * Could these be the same, without deciding anything?
 *
 * Used to pick a union member. Anything unknown, a variable or `dynamic`, counts
 * as compatible, so a union never turns an open question into an error.
 */
function matches(left: Type, right: Type): boolean {
  const a = prune(left);
  const b = prune(right);
  if (a.kind === "dynamic" || b.kind === "dynamic") return true;
  if (a.kind === "var" || b.kind === "var") return true;
  if (a.kind === "union") return a.members.some((m) => matches(m, b));
  if (b.kind === "union") return b.members.some((m) => matches(a, m));
  return matchesConcrete(a, b);
}

function matchesConcrete(a: Type, b: Type): boolean {
  if (a.kind === "literal" || b.kind === "literal") return unifyLiteral(a, b);
  if (a.kind === "list" && b.kind === "list") return matches(a.element, b.element);
  if (a.kind === "opaque" && b.kind === "opaque") return a.name === b.name;
  if (a.kind === "prim" && b.kind === "prim") return a.name === b.name;
  // Shape is left to real unification; here it is enough that the family agrees.
  return a.kind === b.kind && (a.kind === "record" || a.kind === "fn");
}

/** Bind a variable to a type, refusing the infinite type `t = list<t>`. */
function bind(variable: TypeVar, type: Type): boolean {
  if (occurs(variable, type)) return false;
  variable.ref = type;
  return true;
}

function occurs(variable: TypeVar, type: Type): boolean {
  const t = prune(type);
  if (t === variable) return true;
  if (t.kind === "list") return occurs(variable, t.element);
  if (t.kind === "union") return t.members.some((m) => occurs(variable, m));
  if (t.kind === "fn")
    return t.params.some((p) => occurs(variable, p)) || occurs(variable, t.result);
  if (t.kind === "record")
    return (
      [...t.fields.values()].some((f) => occurs(variable, f)) ||
      (t.rest !== undefined && occurs(variable, t.rest))
    );
  return false;
}

function unifyFn(a: FnType, b: FnType): boolean {
  if (a.variadic || b.variadic) return unifyVariadic(a, b);
  const shared = sharedArity(a, b);
  if (shared === undefined) return false;
  for (let at = 0; at < shared; at += 1) {
    if (!unify(a.params[at] as Type, b.params[at] as Type)) return false;
  }
  return unify(a.result, b.result);
}

/**
 * A variadic function takes any number of arguments, so only its result has to
 * agree. What each of them is, though, it may still have said: one declared
 * parameter is what every argument has to be, which is how `range("a")` is wrong
 * for the same reason `range(1, "a")` is.
 */
function unifyVariadic(a: FnType, b: FnType): boolean {
  const [open, called] = a.variadic ? [a, b] : [b, a];
  const each = open.params.length === 1 ? open.params[0] : undefined;
  if (each && !called.variadic) {
    for (const param of called.params) if (!unify(each, param)) return false;
  }
  return unify(a.result, b.result);
}

/**
 * How many parameters the two sides must agree on. Normally all of them, but a
 * callback offered more than it takes agrees on the ones it took, which is how
 * `people.map(p => p.age)` type-checks against a `map` that also passes an index.
 *
 * Exported so the message and the rule cannot drift: a call reported as the
 * wrong number of arguments is exactly one this answered `undefined` for.
 */
export function sharedArity(a: FnType, b: FnType): number | undefined {
  if (a.params.length === b.params.length) return a.params.length;
  const [shorter, longer] = a.params.length < b.params.length ? [a, b] : [b, a];
  const ignorable = longer.ignorableFrom;
  if (ignorable === undefined || shorter.params.length < ignorable) return undefined;
  return shorter.params.length;
}

/**
 * Records unify field by field. An open record (a map used loosely) tolerates
 * fields the other side lacks; a closed one requires the same shape, except for
 * fields that may be absent.
 */
function unifyRecord(a: RecordType, b: RecordType): boolean {
  const open = a.open || b.open;
  if (a.rest && b.rest && !unify(a.rest, b.rest)) return false;
  if (!restHolds(a, b) || !restHolds(b, a)) return false;
  for (const [name, type] of a.fields) {
    const other = b.fields.get(name);
    if (other) {
      if (!unify(type, other)) return false;
    } else if (!open && !omittable(type)) {
      return false;
    }
  }
  return open || everyPresent(b, a);
}

/**
 * A `map<V>` says what every key it did not name holds, and a field is one of
 * those keys. Without this a map of strings would take a map of numbers, which
 * is the whole of what writing `map<string>` was asking about.
 */
function restHolds(from: RecordType, into: RecordType): boolean {
  if (!from.rest) return true;
  for (const [name, type] of into.fields) {
    if (!from.fields.has(name) && !unify(from.rest, type)) return false;
  }
  return true;
}

/**
 * May this field simply not be there?
 *
 * `nickname?: string` is read as `string | null`, a value that may be nothing.
 * Absent and null are the same thing to a reader of the map, so a record that
 * left it out still satisfies one that allows it.
 *
 * Exported so a rule about a missing field asks the same question this does:
 * a `continue` leaving out a field that may be nothing has left out nothing.
 */
export function omittable(type: Type): boolean {
  const t = prune(type);
  if (t.kind === "prim") return t.name === "null";
  return t.kind === "union" && t.members.some(omittable);
}

function everyPresent(from: RecordType, into: RecordType): boolean {
  for (const [name, type] of from.fields) {
    if (!into.fields.has(name) && !omittable(type)) return false;
  }
  return true;
}

/**
 * A field's type on a record. A key nobody listed is whatever the record says
 * its other keys hold, or `dynamic` when it says nothing, which is a loose map.
 */
export function fieldType(record: RecordType, name: string): Type | undefined {
  const known = record.fields.get(name);
  if (known) return known;
  if (!record.open) return undefined;
  return record.rest ?? DYNAMIC;
}

export type { ListType };
