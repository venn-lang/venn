import { applyBinary } from "../../expr/operators.js";
import type { Thunk } from "../compile.types.js";

/**
 * One thunk builder per arithmetic operator, with the operation written out.
 *
 * The repetition is the point. Sharing `(a, b) => a + b` and calling it from
 * the compiled thunk gives one call site eleven different callees, which is
 * megamorphic and stops V8 inlining it. Writing `a + b` into each thunk gives
 * every operator its own site with one callee.
 *
 * Two plain numbers take the short way; anything else (units, strings, values
 * still arriving) falls through to `applyBinary`.
 */
export const FAST_BINARY: Readonly<Record<string, (left: Thunk, right: Thunk) => Thunk>> = {
  "+": (l, r) => (env) => {
    const a = l(env);
    const b = r(env);
    return typeof a === "number" && typeof b === "number" ? a + b : applyBinary("+", a, b);
  },
  "-": (l, r) => (env) => {
    const a = l(env);
    const b = r(env);
    return typeof a === "number" && typeof b === "number" ? a - b : applyBinary("-", a, b);
  },
  "*": (l, r) => (env) => {
    const a = l(env);
    const b = r(env);
    return typeof a === "number" && typeof b === "number" ? a * b : applyBinary("*", a, b);
  },
  "/": (l, r) => (env) => {
    const a = l(env);
    const b = r(env);
    return typeof a === "number" && typeof b === "number" ? a / b : applyBinary("/", a, b);
  },
  "%": (l, r) => (env) => {
    const a = l(env);
    const b = r(env);
    return typeof a === "number" && typeof b === "number" ? a % b : applyBinary("%", a, b);
  },
  "<": (l, r) => (env) => {
    const a = l(env);
    const b = r(env);
    return typeof a === "number" && typeof b === "number" ? a < b : applyBinary("<", a, b);
  },
  "<=": (l, r) => (env) => {
    const a = l(env);
    const b = r(env);
    return typeof a === "number" && typeof b === "number" ? a <= b : applyBinary("<=", a, b);
  },
  ">": (l, r) => (env) => {
    const a = l(env);
    const b = r(env);
    return typeof a === "number" && typeof b === "number" ? a > b : applyBinary(">", a, b);
  },
  ">=": (l, r) => (env) => {
    const a = l(env);
    const b = r(env);
    return typeof a === "number" && typeof b === "number" ? a >= b : applyBinary(">=", a, b);
  },
  "==": (l, r) => (env) => {
    const a = l(env);
    const b = r(env);
    return typeof a === "number" && typeof b === "number" ? a === b : applyBinary("==", a, b);
  },
  "!=": (l, r) => (env) => {
    const a = l(env);
    const b = r(env);
    return typeof a === "number" && typeof b === "number" ? a !== b : applyBinary("!=", a, b);
  },
};
