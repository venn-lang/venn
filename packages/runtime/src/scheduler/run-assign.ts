import {
  type AssignStmt,
  buildProblem,
  CODES,
  evaluate,
  isIndex,
  isMember,
  isRef,
  isReservedKey,
  type Problem,
  ProblemError,
  reservedKeyProblem,
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

/**
 * Both halves of assignment answer the same, including the refusals: a place
 * that is not one, and a key that reaches past the value into what made it.
 */
function place(engine: Engine, stmt: AssignStmt, scope: Scope, value: unknown): void {
  const target = stmt.target;
  // Through the cell, not `set`: `total = 5` inside a block means the binding
  // the block can see, not a new one beside it.
  if (isRef(target)) {
    scope.cell(target.name).value = value;
    return;
  }
  if (!isMember(target) && !isIndex(target)) throw notAPlace(engine, stmt);
  const into = evaluate(target.receiver, scope);
  if (into === null || typeof into !== "object") throw notAPlace(engine, stmt);
  const key = isIndex(target) ? String(evaluate(target.index, scope)) : target.member;
  if (isReservedKey(key)) throw reservedKey(engine, stmt, key);
  (into as Record<string, unknown>)[key] = value;
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

/**
 * Written by the kernel so this half and the compiled one give one sentence.
 *
 * Without it, `m["constructor"]["prototype"]["pwned"] = 7` ran, and afterwards
 * every map, list and string in the process answered 7 to `.pwned`, including
 * those of the flows running beside it.
 */
function reservedKey(engine: Engine, stmt: AssignStmt, key: string): ProblemError {
  return new ProblemError(reservedKeyProblem({ key, span: nodeSpan(stmt, engine.uri) }));
}
