import type { ParallelStmt, Statement } from "@venn-lang/core";
import { type CancelScope, createCancelScope } from "../cancel/index.js";
import type { Scope } from "../scope/index.js";
import { branchEngine } from "./branch-engine.js";
import { runPool } from "./concurrency.js";
import type { Engine } from "./engine.types.js";
import { optsNumber } from "./opts.js";
import { optsText } from "./opts-text.js";
import { runStatement } from "./run-statements.js";
import { CancelSignal, isControlSignal } from "./signals.js";

/**
 * `parallel { concurrency: 2, onError: "collect" } { … }`: run each child
 * statement concurrently.
 *
 * The block does not outlive itself. However it ends, every branch has either
 * finished or been cancelled by the time this returns, and the scope it made is
 * built under the one it was already running in, so an outer `race` or an outer
 * `@timeout` reaches every branch here too.
 */
export async function runParallel(engine: Engine, stmt: ParallelStmt, scope: Scope): Promise<void> {
  const cancel = createCancelScope({ parent: engine.cancel, clock: engine.clock });
  const failures: unknown[] = [];
  try {
    await dispatch({ engine, stmt, scope, cancel, failures });
  } finally {
    cancel.release();
  }
  report(failures);
}

interface DispatchArgs {
  engine: Engine;
  stmt: ParallelStmt;
  scope: Scope;
  cancel: CancelScope;
  failures: unknown[];
}

/** Every child statement, at most `concurrency` of them in flight. */
function dispatch(args: DispatchArgs): Promise<void> {
  const stmts = args.stmt.body.stmts;
  const onError = optsText(args.stmt.opts, "onError", args.scope) ?? "cancel";
  return runPool({
    items: stmts,
    limit: optsNumber(args.stmt.opts, "concurrency", args.scope) ?? stmts.length,
    stop: () => args.cancel.stopped() !== undefined,
    task: (child) => branch({ ...args, child, onError }),
  });
}

interface BranchArgs extends DispatchArgs {
  child: Statement;
  onError: string;
}

/**
 * One branch, and what its failure means for the others.
 *
 * `cancel`, the default, stops the siblings at their next statement boundary,
 * because a run that has already failed should stop working. `collect` lets them
 * all finish and reports every failure, which is what a set of independent
 * checks wants.
 */
async function branch(args: BranchArgs): Promise<void> {
  try {
    await runStatement(branchEngine(args.engine, args.cancel), args.child, args.scope.child());
  } catch (error) {
    // Whatever ended this scope is not this branch's failure to report: it is
    // already being reported by whoever ended it, one level up or ten.
    if (error instanceof CancelSignal || error === args.cancel.stopped()) return;
    if (isControlSignal(error)) throw error;
    args.failures.push(error);
    if (args.onError === "cancel") args.cancel.cancel(new CancelSignal());
  }
}

/**
 * One failure is raised as itself, so the reader sees the message the branch
 * produced. Several are raised together rather than one being picked.
 */
function report(failures: readonly unknown[]): void {
  if (failures.length === 0) return;
  if (failures.length === 1) throw failures[0];
  throw new AggregateError(failures, `${failures.length} parallel branches failed.`);
}
