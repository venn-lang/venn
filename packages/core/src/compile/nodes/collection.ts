import { isWaiting } from "../../expr/pending.js";
import type { ListLit, MapLit, Ternary } from "../../generated/ast.js";
import { truthy } from "../../value/index.js";
import type { Compile, Thunk } from "../compile.types.js";
import { UNROLLED_MAP } from "./map-fields.js";

/**
 * A list literal, built in one pass.
 *
 * The values are collected and watched for at the same time: walking the list
 * again to ask whether anything is waiting would cost a second pass on every
 * literal, which a program shaping many records feels.
 */
export function compileList(expr: ListLit, compile: Compile): Thunk {
  if (expr.items.some((item) => item.spread)) return spreadList(expr, compile);
  const items = expr.items.map((item) => compile(item.value));
  return (env) => {
    const out: unknown[] = [];
    let waiting = false;
    for (let at = 0; at < items.length; at += 1) {
      const value = (items[at] as Thunk)(env);
      waiting = waiting || isWaiting(value);
      out.push(value);
    }
    return waiting ? Promise.all(out) : out;
  };
}

/** One item of a literal that pours a list in, and the ones that do not. */
interface Item {
  readonly spread: boolean;
  readonly value: Thunk;
}

/**
 * A list literal with a `...` in it, which is the uncommon one.
 *
 * Kept apart from the plain path so that a literal without any goes on paying
 * nothing: most of them are written out item by item, and those are built in one
 * pass with no test per item.
 */
function spreadList(expr: ListLit, compile: Compile): Thunk {
  const items: Item[] = expr.items.map((item) => ({
    spread: item.spread,
    value: compile(item.value),
  }));
  return (env) => {
    const values = items.map((item) => item.value(env));
    if (!values.some(isWaiting)) return poured(items, values);
    return Promise.all(values).then((ready) => poured(items, ready));
  };
}

/** A `...` pours its list in; anything else, including nothing, goes in whole. */
function poured(items: readonly Item[], values: readonly unknown[]): unknown[] {
  const out: unknown[] = [];
  items.forEach((item, at) => {
    const value = values[at];
    if (!item.spread) {
      out.push(value);
      return;
    }
    // One at a time: `push(...list)` hands every item over as an argument, and a
    // list of a few hundred thousand overflows the call stack.
    if (Array.isArray(value)) for (const each of value) out.push(each);
  });
  return out;
}

/**
 * A map literal, filled field by field into an empty object.
 *
 * Writing the whole literal at once with computed keys builds faster and is a
 * trap: the object it makes shares no shape with the next one, so every later
 * read of a field is slow. Records are built once and read many times, so the
 * assignment order must stay.
 */
export function compileMap(expr: MapLit, compile: Compile): Thunk {
  if (expr.entries.some((entry) => entry.spread)) return spreadMap(expr, compile);
  // Keys are fixed by the source; only the values are computed.
  // Every entry has a key here: a literal with a spread took the path above.
  const keys = expr.entries.map((entry) => entry.key as string);
  const values = expr.entries.map((entry) => compile(entry.value));
  // The unrolled builders fill by plain assignment, which a `__proto__` key
  // turns into a prototype swap rather than a field, so that literal is looped.
  const build = keys.includes(PROTO_KEY) ? undefined : UNROLLED_MAP[keys.length];
  return build ? build(keys, values, settleFields) : loopedMap(keys, values);
}

/**
 * The one key whose plain write is not a write.
 *
 * `out.constructor = v` and `out.prototype = v` make an ordinary own field:
 * `Object.prototype.constructor` is a plain value that an own field shadows,
 * and nothing inherited answers `prototype` at all. `out.__proto__ = v` instead
 * runs an inherited setter, so `{ "__proto__": { pwned: 7 } }` came back with
 * `{ pwned: 7 }` as its prototype: `typeOf` answered `handle` for a value no
 * plugin made, `.keys` was empty, and reads walked the injected chain.
 *
 * All three are refused as assignment TARGETS (VN3023), where the user names a
 * place that belongs to what made the value. A literal's key names a field of
 * the map being made, so all three are kept here.
 */
const PROTO_KEY = "__proto__";

/**
 * A literal filled field by field, on a tray when one of its keys is
 * `__proto__` so that the write cannot reach a setter.
 *
 * The tray costs an extra copy at the end, which is why only the literal that
 * needs it gets one and the unrolled builders never see it.
 */
function loopedMap(keys: readonly string[], values: readonly Thunk[]): Thunk {
  const onATray = keys.includes(PROTO_KEY);
  return (env) => {
    const out: Record<string, unknown> = onATray ? Object.create(null) : {};
    let waiting = false;
    for (let at = 0; at < keys.length; at += 1) {
      const value = (values[at] as Thunk)(env);
      waiting = waiting || isWaiting(value);
      out[keys[at] as string] = value;
    }
    const done = waiting ? settleFields(out, keys) : out;
    return onATray ? everyday(done) : done;
  };
}

/** A tray handed back as an ordinary map, whether or not it is still settling. */
function everyday(done: Record<string, unknown> | Promise<Record<string, unknown>>): unknown {
  return isWaiting(done) ? done.then((ready) => ({ ...ready })) : { ...done };
}

/** One entry of a literal: a key and its value, or a map poured in whole. */
interface Part {
  readonly key: string | undefined;
  readonly value: Thunk;
}

/**
 * A map literal with a `...` in it, which is the uncommon one, so the shape the
 * unrolled builders make is left to the literals written out field by field.
 */
function spreadMap(expr: MapLit, compile: Compile): Thunk {
  const parts: Part[] = expr.entries.map((entry) => ({
    key: entry.key,
    value: compile(entry.value),
  }));
  return (env) => {
    const values = parts.map((part) => part.value(env));
    if (!values.some(isWaiting)) return filled(parts, values);
    return Promise.all(values).then((ready) => filled(parts, ready));
  };
}

/**
 * Later wins: a key written after a spread overwrites what the spread poured.
 *
 * Filled on a tray with nothing above it, because both halves take their key
 * from somewhere else: the source may spell `__proto__`, and a poured map may
 * carry it as an own field. Either would run the inherited setter and swap the
 * new map's prototype rather than store a field. Unlike a literal written out
 * field by field, a spread's keys are not known until it runs, so the tray is
 * not something this path can opt out of.
 */
function filled(parts: readonly Part[], values: readonly unknown[]): Record<string, unknown> {
  const out: Record<string, unknown> = Object.create(null);
  parts.forEach((part, at) => {
    const value = values[at];
    if (part.key !== undefined) out[part.key] = value;
    else if (isMap(value)) Object.assign(out, value);
  });
  return { ...out };
}

/** Only a map pours into a map. Anything else has no fields to pour. */
function isMap(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Replace each field with what it was waiting for, keeping the same shape. */
async function settleFields(
  out: Record<string, unknown>,
  keys: readonly string[],
): Promise<Record<string, unknown>> {
  const ready = await Promise.all(keys.map((key) => out[key]));
  keys.forEach((key, at) => {
    out[key] = ready[at];
  });
  return out;
}

/**
 * `cond ? a : b`, branching without allocating to do it.
 *
 * Handing the continuation to `whenReady` reads better, but the continuation
 * closes over `env`, so it costs a fresh function object per evaluation. The
 * waiting branch pays that willingly: there it is a real suspension, and one
 * allocation is the least of it.
 */
export function compileTernary(expr: Ternary, compile: Compile): Thunk {
  const condition = compile(expr.condition);
  const then = compile(expr.then);
  const otherwise = compile(expr.otherwise);
  return (env) => {
    const cond = condition(env);
    if (!isWaiting(cond)) return truthy(cond) ? then(env) : otherwise(env);
    return cond.then((ready) => (truthy(ready) ? then(env) : otherwise(env)));
  };
}
