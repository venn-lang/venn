import type { Frame } from "../../expr/frame.js";
import { writeSlot } from "../../expr/frame.js";
import type { Statement } from "../../generated/ast.js";
import * as ast from "../../generated/ast.js";
import { truthy } from "../../value/index.js";
import type { Step } from "../compile.types.js";
import type { LexScope } from "../lex-scope.js";
import { unpack, wholeValueName } from "../unpack.js";
import type { CompileIn } from "./fn.js";

/**
 * One statement of a function body, compiled.
 *
 * A function is pure, so what it can do is decide, bind, loop and give a value
 * back. There is no scheduler here and none is wanted: a body that had to ask
 * one would be a body that could reach the world, and a `fn` cannot.
 *
 * A step answers whether the body has left. `true` stops everything above it,
 * which is how a `return` inside two loops inside an `if` gets out.
 */
export function compileStep(stmt: Statement, scope: LexScope, compile: CompileIn): Step {
  if (ast.isLetStmt(stmt)) return letStep(stmt, scope, compile);
  if (ast.isAssignStmt(stmt)) return assignStep(stmt, scope, compile);
  if (ast.isReturnStmt(stmt)) return returnStep(stmt, scope, compile);
  if (ast.isIfStmt(stmt)) return ifStep(stmt, scope, compile);
  if (ast.isForEachStmt(stmt)) return forEachStep(stmt, scope, compile);
  if (ast.isRepeatStmt(stmt)) return repeatStep(stmt, scope, compile);
  if (ast.isLoopStmt(stmt)) return loopStep(stmt, scope, compile);
  if (ast.isBreakStmt(stmt)) return () => BROKE;
  if (ast.isContinueStmt(stmt)) return () => WENT_ON;
  // Everything a pure body may hold is named above, and the grammar holds it to
  // that at every depth. Anything else stands still rather than stopping the
  // block: a statement nobody compiled must not be able to end the body, which
  // is what made a verb inside an `if` answer `null` and print nothing.
  return () => RAN;
}

/**
 * Why a block stopped, when it did.
 *
 * Numbers rather than thrown signals: a `break` in a loop of fifty thousand
 * would otherwise build fifty thousand stack traces, and the whole reason a
 * body is compiled is that a call is cheap.
 */
export const RAN = 0;
export const LEFT = 1;
export const BROKE = 2;
export const WENT_ON = 3;

/** Run a block's steps until one of them stops. */
export function runSteps(steps: readonly Step[], frame: Frame): number {
  for (const step of steps) {
    const stopped = step(frame);
    if (stopped !== RAN) return stopped;
  }
  return RAN;
}

/** The block a control-flow statement holds, compiled once. */
function blockSteps(
  block: { stmts: Statement[] } | undefined,
  scope: LexScope,
  compile: CompileIn,
): Step[] {
  return (block?.stmts ?? []).map((stmt) => compileStep(stmt, scope, compile));
}

function letStep(stmt: ast.LetStmt, scope: LexScope, compile: CompileIn): Step {
  const value = compile(stmt.value, scope);
  if (!stmt.pattern) {
    const slot = scope.names.indexOf(stmt.name as string);
    return (frame) => {
      writeSlot(frame, slot, value(frame));
      return RAN;
    };
  }
  const whole = scope.names.indexOf(wholeValueName("let", positionOf(stmt)));
  const parts = unpack(stmt.pattern, scope, whole);
  return (frame) => {
    writeSlot(frame, whole, value(frame));
    for (const part of parts) writeSlot(frame, part.slot, part.value(frame));
    return RAN;
  };
}

/** Where this `let` sits among the ones the body holds, for its whole-value slot. */
function positionOf(stmt: ast.LetStmt): number {
  const body = stmt.$container as { stmts?: Statement[] };
  return (body.stmts ?? []).indexOf(stmt as Statement);
}

function assignStep(stmt: ast.AssignStmt, scope: LexScope, compile: CompileIn): Step {
  const value = compile(stmt.value, scope);
  const target = stmt.target;
  if (ast.isRef(target)) {
    const slot = scope.names.indexOf(target.name);
    return (frame) => {
      writeSlot(frame, slot, value(frame));
      return RAN;
    };
  }
  const into = compile((target as { receiver: ast.Expr }).receiver, scope);
  const key = ast.isIndex(target) ? compile(target.index, scope) : undefined;
  const named = ast.isIndex(target) ? undefined : (target as { member: string }).member;
  return (frame) => {
    const holder = into(frame) as Record<string, unknown>;
    holder[named ?? String(key?.(frame))] = value(frame);
    return RAN;
  };
}

function returnStep(stmt: ast.ReturnStmt, scope: LexScope, compile: CompileIn): Step {
  const value = stmt.value ? compile(stmt.value, scope) : undefined;
  return (frame) => {
    frame.left = value ? value(frame) : null;
    return LEFT;
  };
}

function ifStep(stmt: ast.IfStmt, scope: LexScope, compile: CompileIn): Step {
  const condition = compile(stmt.cond, scope);
  const then = blockSteps(stmt.then, scope, compile);
  const otherwise = elseSteps(stmt.otherwise, scope, compile);
  return (frame) => runSteps(truthy(condition(frame)) ? then : otherwise, frame);
}

/** `else if` is another `if`, so the branch is one step rather than a block. */
function elseSteps(
  branch: ast.ElseBranch | undefined,
  scope: LexScope,
  compile: CompileIn,
): Step[] {
  if (!branch) return [];
  if (ast.isIfStmt(branch)) return [ifStep(branch, scope, compile)];
  return blockSteps(branch, scope, compile);
}

function forEachStep(stmt: ast.ForEachStmt, scope: LexScope, compile: CompileIn): Step {
  const source = compile(stmt.source, scope);
  const body = blockSteps(stmt.body, scope, compile);
  const bind = binder(stmt, scope);
  return (frame) => {
    const items = source(frame);
    if (!Array.isArray(items)) return RAN;
    for (const item of items) {
      bind(frame, item);
      const stopped = runSteps(body, frame);
      if (stopped === LEFT) return LEFT;
      if (stopped === BROKE) break;
    }
    return RAN;
  };
}

/** What a `forEach` calls each item, written as a name or as a pattern. */
function binder(stmt: ast.ForEachStmt, scope: LexScope): (frame: Frame, item: unknown) => void {
  if (stmt.item) {
    const slot = scope.names.indexOf(stmt.item);
    return (frame, item) => writeSlot(frame, slot, item);
  }
  const whole = scope.names.indexOf(wholeValueName("each", 0));
  const parts = stmt.pattern ? unpack(stmt.pattern, scope, whole) : [];
  return (frame, item) => {
    writeSlot(frame, whole, item);
    for (const part of parts) writeSlot(frame, part.slot, part.value(frame));
  };
}

function repeatStep(stmt: ast.RepeatStmt, scope: LexScope, compile: CompileIn): Step {
  const count = compile(stmt.count, scope);
  const body = blockSteps(stmt.body, scope, compile);
  const slot = stmt.index ? scope.names.indexOf(stmt.index) : -1;
  return (frame) => {
    const times = Number(count(frame)) || 0;
    for (let at = 0; at < times; at += 1) {
      if (slot !== -1) writeSlot(frame, slot, at);
      const stopped = runSteps(body, frame);
      if (stopped === LEFT) return LEFT;
      if (stopped === BROKE) break;
    }
    return RAN;
  };
}

/**
 * `loop { … }`, `loop cond { … }`, `loop state = initial { … }`.
 *
 * Uncapped, as everywhere else: what ends a loop that should have ended is the
 * timeout around it, and a program that means to run forever is allowed to.
 */
function loopStep(stmt: ast.LoopStmt, scope: LexScope, compile: CompileIn): Step {
  const body = blockSteps(stmt.body, scope, compile);
  const condition = stmt.cond ? compile(stmt.cond, scope) : undefined;
  const state = stmt.state ? scope.names.indexOf(stmt.state.name) : -1;
  const initial = stmt.state ? compile(stmt.state.initial, scope) : undefined;
  return (frame) => {
    if (initial) writeSlot(frame, state, initial(frame));
    while (!condition || truthy(condition(frame))) {
      const stopped = runSteps(body, frame);
      if (stopped === LEFT) return LEFT;
      if (stopped === BROKE) break;
    }
    return RAN;
  };
}
