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

/**
 * `&&`, `||` and `??`, each deciding on the left side alone.
 *
 * The left side is evaluated once and kept: an action can sit in expression
 * position, and running it twice would be a second request.
 *
 * A left side that has not arrived is waited for. Deciding against the promise
 * itself would answer for the wrong value every time, since a promise is
 * neither nothing nor false: `slow() ?? 8080` handed back the promise, and
 * `slow() && f()` ran `f` however the left side turned out.
 */
function compileLogical(op: string, expr: Binary, compile: Compile): Thunk {
  const left = compile(expr.left);
  const right = compile(expr.right);
  if (op === "&&") return andThunk(left, right);
  return op === "||" ? orThunk(left, right) : coalesceThunk(left, right);
}

// One thunk per operator rather than one that asks which it is. The question
// has an answer at compile time, and a call per evaluation is what these three
// exist to avoid.
//
// Each asks its own question first, because a promise is truthy and is not
// nothing: a left side the operator already decided against on those grounds
// cannot be one, so the branch that is taken most is the branch that pays
// nothing for the possibility.

function andThunk(left: Thunk, right: Thunk): Thunk {
  return (env) => {
    const a = left(env);
    if (!truthy(a)) return a;
    return isWaiting(a) ? a.then((ready) => (truthy(ready) ? right(env) : ready)) : right(env);
  };
}

function orThunk(left: Thunk, right: Thunk): Thunk {
  return (env) => {
    const a = left(env);
    if (!truthy(a)) return right(env);
    return isWaiting(a) ? a.then((ready) => (truthy(ready) ? ready : right(env))) : a;
  };
}

function coalesceThunk(left: Thunk, right: Thunk): Thunk {
  return (env) => {
    const a = left(env);
    if (a == null) return right(env);
    return isWaiting(a) ? a.then((ready) => ready ?? right(env)) : a;
  };
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
