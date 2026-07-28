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
  const items = expr.items.map(compile);
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

/**
 * A map literal, filled field by field into an empty object.
 *
 * Writing the whole literal at once with computed keys builds faster and is a
 * trap: the object it makes shares no shape with the next one, so every later
 * read of a field is slow. Records are built once and read many times, so the
 * assignment order must stay.
 */
export function compileMap(expr: MapLit, compile: Compile): Thunk {
  // Keys are fixed by the source; only the values are computed.
  const keys = expr.entries.map((entry) => entry.key);
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
