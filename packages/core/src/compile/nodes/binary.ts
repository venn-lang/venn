import { applyBinary, negate } from "../../expr/operators.js";
import { isWaiting } from "../../expr/pending.js";
import type { Binary, Unary } from "../../generated/ast.js";
import { isNumeric, truthy } from "../../value/index.js";
import type { Compile, Thunk } from "../compile.types.js";
import { FAST_BINARY } from "./fast-binary.js";

/** A binary operation, with its operator resolved at compile time. */
export function compileBinary(expr: Binary, compile: Compile): Thunk {
  const op = expr.operator;
  if (op === "&&" || op === "||" || op === "??") return compileLogical(op, expr, compile);
  const left = compile(expr.left);
  const right = compile(expr.right);
  // Two plain numbers take the short way, in a thunk written for this operator
  // alone; anything else falls back to units.
  const fast = FAST_BINARY[op];
  if (fast) return fast(left, right);
  return (env) => applyBinary(op, left(env), right(env));
}

function compileLogical(op: string, expr: Binary, compile: Compile): Thunk {
  const left = compile(expr.left);
  const right = compile(expr.right);
  // The left side is evaluated once and kept: an action can sit in expression
  // position, and running it twice would be a second request.
  if (op === "&&")
    return (env) => {
      const a = left(env);
      return truthy(a) ? right(env) : a;
    };
  if (op === "||")
    return (env) => {
      const a = left(env);
      return truthy(a) ? a : right(env);
    };
  return (env) => left(env) ?? right(env);
}

/** `!x` and `-x`, taking the settled value straight through when it is one. */
export function compileUnary(expr: Unary, compile: Compile): Thunk {
  const operand = compile(expr.operand);
  if (expr.operator === "!") {
    return (env) => {
      const value = operand(env);
      return isWaiting(value) ? value.then((v) => !truthy(v)) : !truthy(value);
    };
  }
  return (env) => {
    const value = operand(env);
    return isWaiting(value) ? value.then(negated) : negated(value);
  };
}

function negated(value: unknown): unknown {
  return isNumeric(value) ? negate(value) : -Number(value);
}
