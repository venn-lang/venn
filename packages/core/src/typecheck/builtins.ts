import type { TypeContext } from "./context.js";
import { listMember } from "./list-members.js";
import { recordMember } from "./map-members.js";
import {
  BOOL,
  baseOf,
  fn,
  list,
  NUMBER,
  optional,
  prim,
  STRING,
  type Type,
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
  if (t.kind === "record") return recordMember(t, name, ctx);
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

function stringMember(name: string): Type | undefined {
  const table: Record<string, Type> = {
    len: NUMBER,
    upper: STRING,
    lower: STRING,
    trim: STRING,
    reverse: STRING,
    toNumber: NUMBER,
    split: fn([STRING], list(STRING)),
    replace: optional([STRING, STRING], STRING, 1),
    contains: fn([STRING], BOOL),
    startsWith: fn([STRING], BOOL),
    endsWith: fn([STRING], BOOL),
    slice: optional([NUMBER, NUMBER], STRING, 1),
    repeat: fn([NUMBER], STRING),
    padStart: optional([NUMBER, STRING], STRING, 1),
    padEnd: optional([NUMBER, STRING], STRING, 1),
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
    round: optional([NUMBER], NUMBER, 0),
    toFixed: optional([NUMBER], STRING, 0),
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
