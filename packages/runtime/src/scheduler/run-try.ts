import { caughtValue, type TryStmt } from "@venn-lang/core";
import type { Scope } from "../scope/index.js";
import { branchEngine } from "./branch-engine.js";
import type { Engine } from "./engine.types.js";
import { release } from "./report-failure.js";
import { runBlock } from "./run-block.js";
import { isControlSignal } from "./signals.js";

/**
 * `try { } catch e { } finally { }`: control signals pass through, errors go to
 * catch.
 *
 * Nothing is un-counted here. A failure only counts where somebody reported it,
 * and nobody reports one this block handled: an `expect` throws what it found
 * and leaves the reporting to whoever catches it last, which is this catch, and
 * this catch reports nothing. What a step below already reported is that step's
 * verdict and stays: it is on the stream under the step's own name, and a run
 * that erased it printed a red step over a green total.
 */
export async function runTry(engine: Engine, stmt: TryStmt, scope: Scope): Promise<void> {
  try {
    await runBlock(engine, stmt.body, scope.child());
  } catch (error) {
    if (isControlSignal(error)) throw error;
    // Handled here, so the next throw of the same object is a failure of its
    // own rather than a repeat of this one.
    release(error);
    await runCatch({ engine, stmt, scope, error });
  } finally {
    await runFinalizer(engine, stmt, scope);
  }
}

/**
 * `finally { … }`, detached from the scope, exactly as a `defer` is.
 *
 * A finalizer is what gives back what the body took, so a run that was called
 * off is the case it exists for and the one it did not survive: the walk refuses
 * to take a step under an ended scope, and this block's first statement was that
 * step. What it may not do is run for ever, and the grace around the timeout is
 * what says so.
 */
async function runFinalizer(engine: Engine, stmt: TryStmt, scope: Scope): Promise<void> {
  if (!stmt.finalizer) return;
  await runBlock(branchEngine(engine, undefined), stmt.finalizer, scope.child());
}

async function runCatch(args: {
  engine: Engine;
  stmt: TryStmt;
  scope: Scope;
  error: unknown;
}): Promise<void> {
  if (!args.stmt.handler) return;
  const child = args.scope.child();
  if (args.stmt.error) child.set(args.stmt.error, caughtValue(args.error));
  await runBlock(args.engine, args.stmt.handler, child);
}
