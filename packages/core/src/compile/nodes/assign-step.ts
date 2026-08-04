/**
 * `total = total + 1`, `user.name = "a"`, `items[0] = x`, compiled.
 *
 * The other half of `runAssign`, and it has to answer the same. A name is
 * written through the binding it names, wherever that binding lives, and a place
 * that is not a place is refused with the sentence the scheduler already gives
 * rather than with whatever the host says about `null`.
 */

import { buildProblem, CODES } from "../../codes/index.js";
import { type Cell, type Frame, writeNamed, writeSlot } from "../../expr/index.js";
import type { AssignStmt, Expr } from "../../generated/ast.js";
import * as ast from "../../generated/ast.js";
import { ProblemError, type Span } from "../../problem/index.js";
import { spanOf } from "../../span/index.js";
import type { Step, Thunk } from "../compile.types.js";
import type { LexScope } from "../lex-scope.js";
import type { CompileIn } from "./fn.js";
import { RAN } from "./stopped.js";

/** What a member or an index works out to, read once per write. */
type Key = (frame: Frame) => string;

/** One assignment, compiled into a step over the frame. */
export function assignStep(stmt: AssignStmt, scope: LexScope, compile: CompileIn): Step {
  const value = compile(stmt.value, scope);
  const target = stmt.target;
  if (ast.isRef(target)) return toName(target.name, value, scope);
  return intoPlace({ stmt, value, scope, compile });
}

/**
 * A name the body binds is a slot. One it does not is the binding it names,
 * which is the cell a closure captured or a slot of the frame that holds it.
 */
function toName(name: string, value: Thunk, scope: LexScope): Step {
  const slot = scope.names.indexOf(name);
  if (slot !== -1) {
    return (frame) => {
      writeSlot(frame, slot, value(frame));
      return RAN;
    };
  }
  const own = scope.cellOf?.(name);
  return own ? intoCell(own, value) : outward(name, value);
}

function intoCell(cell: Cell, value: Thunk): Step {
  return (frame) => {
    cell.value = value(frame);
    return RAN;
  };
}

function outward(name: string, value: Thunk): Step {
  return (frame) => {
    writeNamed(frame, name, value(frame));
    return RAN;
  };
}

/** `a.b = x` and `a[i] = x`: written into the value, which every holder sees. */
function intoPlace(args: {
  stmt: AssignStmt;
  value: Thunk;
  scope: LexScope;
  compile: CompileIn;
}): Step {
  const { stmt, value, scope, compile } = args;
  const target = stmt.target;
  const into = compile((target as { receiver: Expr }).receiver, scope);
  const key = keyOf(target, scope, compile);
  return writeInto({ into, key, value, span: spanOf(stmt, "") });
}

function writeInto(args: { into: Thunk; key: Key; value: Thunk; span: Span }): Step {
  const { into, key, value, span } = args;
  return (frame) => {
    const holder = into(frame);
    if (holder === null || typeof holder !== "object") throw notAPlace(span);
    (holder as Record<string, unknown>)[key(frame)] = value(frame);
    return RAN;
  };
}

/** The member's own name, or whatever the index works out to. */
function keyOf(target: Expr, scope: LexScope, compile: CompileIn): Key {
  if (!ast.isIndex(target)) {
    const named = (target as { member: string }).member;
    return () => named;
  }
  const index = compile(target.index, scope);
  return (frame) => String(index(frame));
}

/** The scheduler's sentence, because one fact said two ways is how paths drift. */
function notAPlace(span: Span): ProblemError {
  return new ProblemError(
    buildProblem({
      spec: CODES.VN3021_NOT_A_PLACE,
      span,
      title: "There is nothing here to write to.",
    }),
  );
}
