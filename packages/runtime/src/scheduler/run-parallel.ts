import type { ParallelStmt, Statement } from "@venn/core";
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
 * finished or been cancelled by the time this returns: `Promise.all` on its own
 * rejects at the first failure and leaves the rest running, which is how a
 * finished test carries on making requests.
 */
export async function runParallel(engine: Engine, stmt: ParallelStmt, scope: Scope): Promise<void> {
  const limit = optsNumber(stmt.opts, "concurrency", scope) ?? stmt.body.stmts.length;
  const onError = optsText(stmt.opts, "onError", scope) ?? "cancel";
  const controller = new AbortController();
  const failures: unknown[] = [];
  await runPool(stmt.body.stmts, Math.max(1, limit), (child) =>
    branch({ engine, child, scope, controller, failures, onError }),
  );
  report(failures);
}

interface BranchArgs {
  engine: Engine;
  child: Statement;
  scope: Scope;
  controller: AbortController;
  failures: unknown[];
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
  const engine = branchEngine(args.engine, args.controller.signal);
  try {
    await runStatement(engine, args.child, args.scope.child());
  } catch (error) {
    if (error instanceof CancelSignal) return;
    if (isControlSignal(error)) throw error;
    args.failures.push(error);
    if (args.onError === "cancel") args.controller.abort();
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
