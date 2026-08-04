import type { Frame } from "../../expr/frame.js";
import { writeSlot } from "../../expr/frame.js";
import type { Statement } from "../../generated/ast.js";
import * as ast from "../../generated/ast.js";
import { truthy } from "../../value/index.js";
import type { Step, Thunk } from "../compile.types.js";
import { allocate, blockScope, declare, type LexScope, slotOf } from "../lex-scope.js";
import { unpack } from "../unpack.js";
import { assignStep } from "./assign-step.js";
import type { CompileIn } from "./fn.js";
import { checkedCount, checkedList } from "./loop-bound.js";
import { refuseACall } from "./pure-body.js";
import { BROKE, LEFT, RAN, WENT_ON } from "./stopped.js";

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
  if (ast.isContinueStmt(stmt)) return continueStep(stmt, scope, compile);
  // Everything a pure body may hold is named above, and the grammar holds it to
  // that at every depth. Anything else stands still rather than stopping the
  // block: a statement nobody compiled must not be able to end the body, which
  // is what made a verb inside an `if` answer `null` and print nothing.
  return () => RAN;
}

export { BROKE, LEFT, RAN, WENT_ON } from "./stopped.js";

/** Run a block's steps until one of them stops. */
export function runSteps(steps: readonly Step[], frame: Frame): number {
  for (const step of steps) {
    const stopped = step(frame);
    if (stopped !== RAN) return stopped;
  }
  return RAN;
}

/**
 * The block a control-flow statement holds, compiled once, in a scope of its own.
 *
 * Its bindings are slots of the function like every other, because a call has
 * one frame and not a chain of them. What the block gives them is a name in view
 * for its own statements and gone afterwards, which is what `let` means at the
 * top of a file and what it did not mean here: every block was flattened into
 * one list, so a `let` inside a loop overwrote the outer name of the same
 * spelling and a loop's own binding outlived its loop.
 */
function blockSteps(
  block: { stmts: Statement[] } | undefined,
  scope: LexScope,
  compile: CompileIn,
): Step[] {
  return stepsIn(block, blockScope(scope), compile);
}

/** The same, in a scope the caller already made because it bound a name in it. */
function stepsIn(
  block: { stmts: Statement[] } | undefined,
  inner: LexScope,
  compile: CompileIn,
): Step[] {
  return (block?.stmts ?? []).map((stmt) => compileStep(stmt, inner, compile));
}

function letStep(stmt: ast.LetStmt, scope: LexScope, compile: CompileIn): Step {
  refuseACall(stmt);
  // The value first and the name after, so `let x = x` reads the one already in
  // view, which is what the same line does everywhere else.
  const value = compile(stmt.value, scope);
  if (!stmt.pattern) {
    const slot = declare(scope, stmt.name as string);
    return (frame) => {
      writeSlot(frame, slot, value(frame));
      return RAN;
    };
  }
  const whole = allocate(scope);
  const parts = unpack(stmt.pattern, scope, whole);
  return (frame) => {
    writeSlot(frame, whole, value(frame));
    for (const part of parts) writeSlot(frame, part.slot, part.value(frame));
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
  const listed = checkedList(stmt.source);
  // The item belongs to the body rather than to whoever wrote the loop, so it is
  // bound in the body's own scope and is gone once the loop ends.
  const inner = blockScope(scope);
  const bind = binder(stmt, inner);
  const body = stepsIn(stmt.body, inner, compile);
  return (frame) => {
    for (const item of listed(source(frame))) {
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
    const slot = declare(scope, stmt.item);
    return (frame, item) => writeSlot(frame, slot, item);
  }
  const whole = allocate(scope);
  const parts = stmt.pattern ? unpack(stmt.pattern, scope, whole) : [];
  return (frame, item) => {
    writeSlot(frame, whole, item);
    for (const part of parts) writeSlot(frame, part.slot, part.value(frame));
  };
}

/**
 * `repeat n as i { … }`.
 *
 * `as` names the pass, and a pass is counted from one: the first time round is
 * pass one, here and in the scheduler alike. Counting the passes rather than the
 * offsets is also what makes a fractional count run the whole passes it asks for
 * and no more, since the last one it could finish is the one at `n` rounded down.
 */
function repeatStep(stmt: ast.RepeatStmt, scope: LexScope, compile: CompileIn): Step {
  const count = compile(stmt.count, scope);
  const counted = checkedCount(stmt.count);
  const inner = blockScope(scope);
  const slot = stmt.index ? declare(inner, stmt.index) : -1;
  const body = stepsIn(stmt.body, inner, compile);
  return (frame) => {
    const times = counted(count(frame));
    for (let at = 1; at <= times; at += 1) {
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
 * The state gets its slot filled once, before the first pass, so both ways of
 * advancing it land in the same place: `continue next` writes the slot, and so
 * does a plain `state = next`. Re-binding the name at the top of every pass
 * would throw the second one away, and a loop that never advances never ends.
 *
 * Uncapped, as everywhere else: what ends a loop that should have ended is the
 * timeout around it, and a program that means to run forever is allowed to.
 */
function loopStep(stmt: ast.LoopStmt, scope: LexScope, compile: CompileIn): Step {
  const initial = stmt.state ? compile(stmt.state.initial, scope) : undefined;
  // The state outlives the loop, so it belongs to the block the loop is written
  // in rather than to the body: `loop n = 1 { … }` leaves `n` readable after it.
  const state = stmt.state ? declare(scope, stmt.state.name) : -1;
  const condition = stmt.cond ? compile(stmt.cond, scope) : undefined;
  const body = blockSteps(stmt.body, scope, compile);
  return (frame) => {
    if (initial) writeSlot(frame, state, initial(frame));
    return passes(body, condition, frame);
  };
}

/** Round and round until the condition stops holding, or something stops it. */
function passes(body: readonly Step[], condition: Thunk | undefined, frame: Frame): number {
  while (!condition || truthy(condition(frame))) {
    const stopped = runSteps(body, frame);
    if (stopped === LEFT) return LEFT;
    if (stopped === BROKE) break;
  }
  return RAN;
}

/**
 * `continue`, and `continue next` where the loop carries a state.
 *
 * The value goes into the state's slot, which is the same slot a plain
 * assignment writes, so the next pass starts from it and the name still holds
 * the last one after the loop. A value handed to a `repeat` or a `forEach` has
 * nowhere to go: it is evaluated, because the source asked for it, and dropped.
 */
function continueStep(stmt: ast.ContinueStmt, scope: LexScope, compile: CompileIn): Step {
  if (!stmt.value) return () => WENT_ON;
  const value = compile(stmt.value, scope);
  const slot = carriedSlot(stmt, scope);
  return (frame) => {
    const next = value(frame);
    if (slot !== -1) writeSlot(frame, slot, next);
    return WENT_ON;
  };
}

/** The slot the enclosing `loop` carries its state in, or `-1` when there is none. */
function carriedSlot(stmt: ast.ContinueStmt, scope: LexScope): number {
  let up = stmt.$container as { $container?: unknown } | undefined;
  while (up) {
    if (ast.isFnExpr(up) || ast.isFnDecl(up)) return -1;
    if (ast.isForEachStmt(up) || ast.isRepeatStmt(up)) return -1;
    if (ast.isLoopStmt(up)) return up.state ? slotOf(scope, up.state.name) : -1;
    up = up.$container as { $container?: unknown } | undefined;
  }
  return -1;
}
