import {
  type AssignStmt,
  buildProblem,
  CODES,
  type Expr,
  evaluate,
  isIndex,
  isMember,
  isRef,
  type Problem,
  ProblemError,
} from "@venn-lang/core";
import type { Scope } from "../scope/index.js";
import type { Engine } from "./engine.types.js";
import { nodeSpan } from "./node-span.js";
import type { Pending } from "./pending.types.js";
import { isPending } from "./settled.js";

/**
 * `total = total + 1`, `user.name = "a"`, `items[0] = x`.
 *
 * A name is written through its cell, which is the same cell a closure captured
 * when it was built. So a function that reads `total` reads what the assignment
 * left, rather than what the name held the moment the function was made: what a
 * closure captures is the binding, not a copy of it.
 *
 * A member or an index is written into the value itself, which every holder of
 * that value sees. That is what a map is: one thing, named in more than one
 * place.
 */
export function runAssign(engine: Engine, stmt: AssignStmt, scope: Scope): Pending {
  const value = evaluate(stmt.value, scope);
  if (isPending(value)) return value.then((settled) => place(engine, stmt, scope, settled));
  place(engine, stmt, scope, value);
  return undefined;
}

function place(engine: Engine, stmt: AssignStmt, scope: Scope, value: unknown): void {
  const target = stmt.target;
  // Through the cell, not `set`, which writes locally: `total = 5` inside a
  // block means the binding the block can see, not a new one beside it.
  if (isRef(target)) {
    scope.cell(target.name).value = value;
    return;
  }
  const into = holder(engine, stmt, scope);
  const key = isIndex(target)
    ? evaluate(target.index, scope)
    : (target as { member: string }).member;
  if (into === null || typeof into !== "object") throw notAPlace(engine, stmt);
  (into as Record<string, unknown>)[String(key)] = value;
}

/** What is being written into: the value the path leads to, minus its last step. */
function holder(engine: Engine, stmt: AssignStmt, scope: Scope): unknown {
  const target = stmt.target as Expr & { receiver?: Expr };
  if (!isMember(target) && !isIndex(target)) throw notAPlace(engine, stmt);
  return evaluate(target.receiver as Expr, scope);
}

function notAPlace(engine: Engine, stmt: AssignStmt): ProblemError {
  return new ProblemError(problemOf(engine, stmt));
}

function problemOf(engine: Engine, stmt: AssignStmt): Problem {
  return buildProblem({
    spec: CODES.VN3021_NOT_A_PLACE,
    span: nodeSpan(stmt, engine.uri),
    title: "There is nothing here to write to.",
  });
}
