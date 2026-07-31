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
  const build = UNROLLED_MAP[keys.length];
  if (build) return build(keys, values, settleFields);
  return (env) => {
    const out: Record<string, unknown> = {};
    let waiting = false;
    for (let at = 0; at < keys.length; at += 1) {
      const value = (values[at] as Thunk)(env);
      waiting = waiting || isWaiting(value);
      out[keys[at] as string] = value;
    }
    return waiting ? settleFields(out, keys) : out;
  };
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

/** Later wins: a key written after a spread overwrites what the spread poured. */
function filled(parts: readonly Part[], values: readonly unknown[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  parts.forEach((part, at) => {
    const value = values[at];
    if (part.key !== undefined) out[part.key] = value;
    else if (isMap(value)) Object.assign(out, value);
  });
  return out;
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
