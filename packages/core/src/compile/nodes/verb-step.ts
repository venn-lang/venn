import type { AstNode } from "langium";
import { dottedPath } from "../../ast/index.js";
import { type EvalEnv, invoke, isWaiting, memberValue } from "../../expr/index.js";
import { failError } from "../../fail/index.js";
import type { ActionCall, Expr, LetStmt, MapLit } from "../../generated/ast.js";
import { fileOf } from "../../parse/index.js";
import { spanOf } from "../../span/index.js";
import { compileRef } from "../compile.js";
import type { Step, Thunk } from "../compile.types.js";
import type { LexScope } from "../lex-scope.js";
import type { CompileIn } from "./fn.js";
import { RAN } from "./stopped.js";

/**
 * The one verb that is control flow rather than an effect.
 *
 * A raise ends the body instead of reaching out of it, so it answers the same
 * way for the same arguments wherever it is written. That is why the compiler
 * builds it into the body rather than calling it: there is no value for the
 * statement after it to wait on, and no call for a stack to unwind through.
 */
export const RAISES = "fail";

/**
 * A verb written as a statement of a body.
 *
 * `fail` is compiled here rather than called, because raising is control flow:
 * it ends the body instead of answering, so it has no value for the statement
 * after it to wait on and no call for a stack to unwind through.
 *
 * Every other verb is the value its name resolves to, called with the arguments
 * written after it. `io.print "x"` reads `print` off the `io` namespace the way
 * `io.print("x")` in an expression already did, and a bare `print "x"` reads the
 * name the runtime bound for it. Nothing about the dispatch is new: what used to
 * be missing was a compiled body admitting it could reach the world at all.
 *
 * What the verb answers is dropped, and waited for first when it has not
 * arrived. Dropping it without waiting is how two lines of a body would run at
 * once and the second would read the world before the first had changed it.
 *
 * @param call The call, as the grammar read it.
 * @param scope The block it is written in, for the arguments it evaluates.
 * @param compile How to compile those arguments.
 * @returns A step that raises for `fail`, and one that runs the verb otherwise.
 */
export function compileVerb(call: ActionCall, scope: LexScope, compile: CompileIn): Step {
  if (call.target === RAISES) {
    return raiseStep({ at: call, said: messageOf(call), opts: call.opts, scope, compile });
  }
  const run = calling({
    callee: verbValue(call.target, scope),
    args: argsOf(call).map((arg) => compile(arg, scope)),
    site: call.args[0],
  });
  return (frame) => dropped(run(frame));
}

/**
 * One verb call, over arguments compiled where they were written.
 *
 * Shared by the statement and the bound spelling so the two cannot drift: what
 * `io.print "x"` does and what `let said = io.print "x"` does differ only in
 * whether the answer is kept.
 */
function calling(args: { callee: Thunk; args: readonly Thunk[]; site: Expr | undefined }): Thunk {
  const { callee, args: written, site } = args;
  return (frame) =>
    invoke(
      callee(frame),
      written.map((one) => one(frame)),
      site,
    );
}

/**
 * The verb as a value: the name it starts with, then the members after it.
 *
 * `compileRef` is what an ordinary name in an expression compiles to, so a verb
 * reaches its namespace by the one path the language already had rather than by
 * a second one that could disagree with it.
 */
function verbValue(target: string, scope: LexScope): Thunk {
  const [head, ...members] = target.split(".");
  let so = compileRef(head as string, scope);
  for (const member of members) {
    const read = so;
    so = (frame) => memberValue(read(frame), member);
  }
  return so;
}

/** Both spellings of a verb's arguments: `close()` puts them somewhere else. */
function argsOf(call: ActionCall): Expr[] {
  if (call.args.length > 0) return call.args;
  return (call.call?.args ?? []).map((one) => one.value);
}

/** A verb statement keeps nothing, and answers only once the verb has finished. */
function dropped(answer: unknown): number | Promise<number> {
  return isWaiting(answer) ? answer.then(() => RAN) : RAN;
}

/**
 * `let stop = fail "no"`, which is a raise with a name in front of it.
 *
 * The trailing argument is what makes a `let` a call, and the checker allows
 * this one because `fail` is the verb a pure body may run. So the compiler has
 * to run it: compiling the value alone bound the callee, raised nothing, and let
 * the body carry on to answer as though the guard had passed. The binding itself
 * is never written, because a raise leaves before there is anything to write.
 *
 * @param stmt The binding, as the grammar read it.
 * @param scope The block it is written in, for the message it evaluates.
 * @param compile How to compile that message.
 * @returns The raise, or nothing when this binding is not one.
 */
export function compileBoundRaise(
  stmt: LetStmt,
  scope: LexScope,
  compile: CompileIn,
): Thunk | undefined {
  if (stmt.args.length === 0 && !stmt.opts) return undefined;
  if (dottedPath(stmt.value) !== RAISES) return undefined;
  return raiseStep({ at: stmt, said: stmt.args[0], opts: stmt.opts, scope, compile });
}

/**
 * `let said = io.print "hello"`, which is a verb with a name in front of it.
 *
 * The trailing arguments are what make a `let` a call. Compiling the value
 * alone bound the callee and ran nothing, which is why this used to be refused
 * rather than left alone. It is compiled now, and what the verb answers is what
 * the name holds.
 *
 * A bound `fail` is not one of these: {@link compileBoundRaise} takes it first,
 * because a raise leaves before there is anything to bind.
 *
 * @param stmt The binding, as the grammar read it.
 * @param scope The block it is written in, for the arguments it evaluates.
 * @param compile How to compile those arguments.
 * @returns The call, or nothing when this binding is not one.
 */
export function compileBoundCall(
  stmt: LetStmt,
  scope: LexScope,
  compile: CompileIn,
): Thunk | undefined {
  if (stmt.args.length === 0) return undefined;
  const target = dottedPath(stmt.value);
  if (target === undefined || target === RAISES) return undefined;
  return calling({
    callee: verbValue(target, scope),
    args: stmt.args.map((arg) => compile(arg, scope)),
    site: stmt.args[0],
  });
}

/** One raise, whether a name was written in front of it or not. */
interface Raised {
  /** The node the failure points at, and the span it reports. */
  at: AstNode;
  /** The line the reader gave it, if they gave one. */
  said: Expr | undefined;
  /** The trailing `{ code, data }`, if they wrote one. */
  opts: MapLit | undefined;
  scope: LexScope;
  compile: CompileIn;
}

/**
 * A raise never returns, and needs only the environment to build its message.
 *
 * That is why one function serves both callers: a `(env) => never` satisfies
 * `Step`, whose frame is an environment and whose `number` it never reaches,
 * and `Thunk`, which is what a `let` binds. Typing it as either one alone would
 * force a cast at the other, and a cast here would be asserting the thing the
 * signature is meant to prove.
 */
function raiseStep(raised: Readonly<Raised>): (env: EvalEnv) => never {
  const { at, said, opts, scope, compile } = raised;
  const message = said ? compile(said, scope) : undefined;
  // The same span the checker would point at: the line that refused, not the
  // body around it, so `e.where` names it.
  const where = spanOf(at, fileOf(at));
  const written = opts ? compile(opts, scope) : undefined;
  return (frame) => {
    const carried = (written?.(frame) ?? {}) as Record<string, unknown>;
    throw failError({ message: String(message?.(frame) ?? ""), opts: carried, where });
  };
}

/**
 * The line a `fail` was given, whether it was written bare or in brackets.
 *
 * Both spellings reach the scheduler as the same first argument, so both reach
 * the same failure from here. The `{ code, data }` is the trailing map in either
 * case, which is what `opts` already holds.
 */
function messageOf(call: ActionCall): Expr | undefined {
  return call.args[0] ?? call.call?.args[0]?.value;
}
