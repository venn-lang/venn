import type { Thunk } from "../compile.types.js";
import type { SlowBinary } from "./binary-slow.types.js";

/**
 * One thunk builder per arithmetic operator, with the operation written out.
 *
 * The repetition is the point. Sharing `(a, b) => a + b` and calling it from
 * the compiled thunk gives one call site eleven different callees, which is
 * megamorphic and stops V8 inlining it. Writing `a + b` into each thunk gives
 * every operator its own site with one callee.
 *
 * Two plain numbers take the short way; anything else (units, strings, values
 * still arriving) falls through to `slow`, which is the general path already
 * told which node it belongs to.
 */
export const FAST_BINARY: Readonly<
  Record<string, (left: Thunk, right: Thunk, slow: SlowBinary) => Thunk>
> = {
  "+": (l, r, slow) => (env) => {
    const a = l(env);
    const b = r(env);
    return typeof a === "number" && typeof b === "number" ? a + b : slow(a, b);
  },
  "-": (l, r, slow) => (env) => {
    const a = l(env);
    const b = r(env);
    return typeof a === "number" && typeof b === "number" ? a - b : slow(a, b);
  },
  "*": (l, r, slow) => (env) => {
    const a = l(env);
    const b = r(env);
    return typeof a === "number" && typeof b === "number" ? a * b : slow(a, b);
  },
  // The zero goes the slow way so it meets the refusal: `a / 0` is `Infinity`
  // here and there is no telling that from a real answer once it is out.
  "/": (l, r, slow) => (env) => {
    const a = l(env);
    const b = r(env);
    return typeof a === "number" && typeof b === "number" && b !== 0 ? a / b : slow(a, b);
  },
  "%": (l, r, slow) => (env) => {
    const a = l(env);
    const b = r(env);
    return typeof a === "number" && typeof b === "number" && b !== 0 ? a % b : slow(a, b);
  },
  "<": (l, r, slow) => (env) => {
    const a = l(env);
    const b = r(env);
    return typeof a === "number" && typeof b === "number" ? a < b : slow(a, b);
  },
  "<=": (l, r, slow) => (env) => {
    const a = l(env);
    const b = r(env);
    return typeof a === "number" && typeof b === "number" ? a <= b : slow(a, b);
  },
  ">": (l, r, slow) => (env) => {
    const a = l(env);
    const b = r(env);
    return typeof a === "number" && typeof b === "number" ? a > b : slow(a, b);
  },
  ">=": (l, r, slow) => (env) => {
    const a = l(env);
    const b = r(env);
    return typeof a === "number" && typeof b === "number" ? a >= b : slow(a, b);
  },
  "==": (l, r, slow) => (env) => {
    const a = l(env);
    const b = r(env);
    return typeof a === "number" && typeof b === "number" ? a === b : slow(a, b);
  },
  "!=": (l, r, slow) => (env) => {
    const a = l(env);
    const b = r(env);
    return typeof a === "number" && typeof b === "number" ? a !== b : slow(a, b);
  },
};
