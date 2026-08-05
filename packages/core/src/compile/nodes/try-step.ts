import type { Frame } from "../../expr/index.js";
import type { Statement, TryStmt } from "../../generated/ast.js";
import { caughtValue, isFailure } from "../../problem/index.js";
import { slotBinder } from "../box.js";
import type { Step } from "../compile.types.js";
import { blockScope, declare, type LexScope } from "../lex-scope.js";
import type { CompileIn } from "./fn.js";
import { RAN } from "./stopped.js";
import { runSteps } from "./walk-steps.js";

/** How the body compiler compiles a block, handed in so this file reaches no dispatcher. */
type StepsIn = (
  block: { stmts: Statement[] } | undefined,
  inner: LexScope,
  compile: CompileIn,
) => Step[];

/** What a handler does with the failure it caught: bind the name, run the block. */
type Handler = (frame: Frame, failure: unknown) => number;

/** Everything the compiler hands down to reach a block from here. */
interface TryArgs {
  compile: CompileIn;
  stepsIn: StepsIn;
}

/**
 * `try { … } catch e { … } finally { … }` inside a pure body.
 *
 * The blocks run rather than give a value back, which is what makes a `return`
 * inside one a return from the function: a step answers why the body ended and
 * that answer travels out of here untouched. Where a value is wanted the braced
 * `try` expression holds one expression per brace instead.
 *
 * What is caught is a failure, and a `fail` written in a `fn` is now one of the
 * things a pure body raises. A control signal is not: a `return` from inside the
 * attempt is the function leaving, not the attempt failing, and swallowing it
 * here would turn a `return` into a handled error.
 *
 * @param stmt The statement, as the grammar read it.
 * @param scope The block it is written in.
 * @param args How to compile an expression, and how to compile a block.
 * @returns A step answering why the body ended, the handler's answer included.
 */
export function tryStep(stmt: TryStmt, scope: LexScope, args: TryArgs): Step {
  const attempt = args.stepsIn(stmt.body, blockScope(scope), args.compile);
  const caught = handlerOf(stmt, scope, args);
  const after = finallyOf(stmt, scope, args);
  return (frame) => {
    try {
      return recovering({ attempt, caught }, frame);
    } finally {
      if (after) runSteps(after, frame);
    }
  };
}

/**
 * The `finally` block, when there is one.
 *
 * Its answer is never read: a `finally` runs for its effect, and honouring a
 * `return` written there would mean swallowing whatever was unwinding.
 */
function finallyOf(stmt: TryStmt, scope: LexScope, args: TryArgs): Step[] | undefined {
  if (!stmt.finalizer) return undefined;
  return args.stepsIn(stmt.finalizer, blockScope(scope), args.compile);
}

/** The attempt, and the handler when it was the attempt that failed. */
function recovering(
  blocks: { attempt: readonly Step[]; caught: Handler | undefined },
  frame: Frame,
): number {
  try {
    return runSteps(blocks.attempt, frame);
  } catch (failure) {
    if (!blocks.caught || !isFailure(failure)) throw failure;
    return blocks.caught(frame, failure);
  }
}

/**
 * The `catch` block, with its name bound in a scope of its own.
 *
 * The name belongs to the handler rather than to whoever wrote the `try`, so it
 * gets a slot in the handler's block and is gone once the block ends, exactly as
 * a `forEach` item is. What it holds is the `caughtValue` every other `catch` in
 * the language binds, so a program reads the same six members wherever it is.
 */
function handlerOf(stmt: TryStmt, scope: LexScope, args: TryArgs): Handler | undefined {
  if (!stmt.handler) return undefined;
  const inner = blockScope(scope);
  const bind = stmt.error ? slotBinder(inner, declare(inner, stmt.error)) : undefined;
  const steps = args.stepsIn(stmt.handler, inner, args.compile);
  return (frame, failure) => {
    if (bind) bind(frame, caughtValue(failure));
    return steps.length === 0 ? RAN : runSteps(steps, frame);
  };
}
