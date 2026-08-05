/**
 * `total = total + 1`, `user.name = "a"`, `items[0] = x`, compiled.
 *
 * The other half of `runAssign`, and it has to answer the same. A name is
 * written through the binding it names, wherever that binding lives, and a place
 * that is not a place is refused with the sentence the scheduler already gives
 * rather than with whatever the host says about `null`.
 */

import { buildProblem, CODES } from "../../codes/index.js";
import { type Cell, type Frame, readSlot, writeNamed, writeSlot } from "../../expr/index.js";
import type { AssignStmt, Expr } from "../../generated/ast.js";
import * as ast from "../../generated/ast.js";
import { fileOf } from "../../parse/index.js";
import { ProblemError, type Span } from "../../problem/index.js";
import { spanOf } from "../../span/index.js";
import { isReservedKey, reservedKeyProblem } from "../../value/index.js";
import type { Step, Thunk } from "../compile.types.js";
import { boxed, freeSlot, type LexScope, rootOf, slotOf } from "../lex-scope.js";
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
 * Where a write goes, asked exactly as a read of the same name is.
 *
 * A name the body binds is a slot. One it does not is a cell this body holds,
 * or a cell the closure resolved where it was written. One name in one place is
 * one binding, so a read and a write of it have to be told apart by nothing.
 */
function toName(name: string, value: Thunk, scope: LexScope): Step {
  // `slotOf`, not a search of the flat name list: a block that shadows a name
  // has a slot of its own, and the flat list finds the outermost whoever asks,
  // so a write inside the block landed on the binding outside it.
  const slot = slotOf(scope, name);
  if (slot !== -1) return intoSlot(slot, value, boxed(scope, slot));
  const own = rootOf(scope).cellOf?.(name);
  if (own) return intoCell(own, value);
  const up = freeSlot(scope, name);
  return up === undefined ? outward(name, value) : intoUp(up, name, value);
}

/**
 * A captured slot holds a cell, and the write goes through it, not over it, so
 * the closures already holding it see the new value.
 *
 * A cell that is not there yet is the block that never ran: the slot takes one,
 * which is what the binding would have done had it been reached. A name a
 * `match` arm or a `try … catch` declares is in view from the body's first line
 * while its cell is minted only when the arm runs, so this is reachable from
 * source, and without it the write was a host TypeError.
 */
function intoSlot(slot: number, value: Thunk, box: boolean): Step {
  if (!box) {
    return (frame) => {
      writeSlot(frame, slot, value(frame));
      return RAN;
    };
  }
  return (frame) => {
    const cell = readSlot(frame, slot) as Cell | undefined;
    if (cell) cell.value = value(frame);
    else writeSlot(frame, slot, { value: value(frame) });
    return RAN;
  };
}

function intoCell(cell: Cell, value: Thunk): Step {
  return (frame) => {
    cell.value = value(frame);
    return RAN;
  };
}

/** A free name of this body: the cell the closure was handed when it was made. */
function intoUp(up: number, name: string, value: Thunk): Step {
  return (frame) => {
    const cell = frame.up?.[up];
    if (cell) cell.value = value(frame);
    else writeNamed(frame, name, value(frame));
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
  return writeInto({ into, key, value, span: spanOf(stmt, fileOf(stmt)) });
}

function writeInto(args: { into: Thunk; key: Key; value: Thunk; span: Span }): Step {
  const { into, key, value, span } = args;
  return (frame) => {
    const holder = into(frame);
    if (holder === null || typeof holder !== "object") throw notAPlace(span);
    const at = key(frame);
    if (isReservedKey(at)) throw new ProblemError(reservedKeyProblem({ key: at, span }));
    (holder as Record<string, unknown>)[at] = value(frame);
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
