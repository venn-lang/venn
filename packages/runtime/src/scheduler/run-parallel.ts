import type { ParallelStmt, Statement } from "@venn-lang/core";
import { type CancelScope, createCancelScope } from "../cancel/index.js";
import type { Scope } from "../scope/index.js";
import { branchEngine } from "./branch-engine.js";
import { runPool } from "./concurrency.js";
import type { Engine } from "./engine.types.js";
import { nodeSpan } from "./node-span.js";
import { readOptions } from "./read-options.js";
import { claim, reportFailure } from "./report-failure.js";
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
  const kind = "ParallelStmt";
  const opts = await readOptions({ opts: stmt.opts, kind, scope, uri: engine.uri });
  const cancel = createCancelScope({ parent: engine.cancel, clock: engine.clock });
  const failures: unknown[] = [];
  try {
    await dispatch({ engine, stmt, scope, cancel, failures, opts });
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
  opts: Record<string, unknown>;
}

/** Every child statement, at most `concurrency` of them in flight. */
function dispatch(args: DispatchArgs): Promise<void> {
  const stmts = args.stmt.body.stmts;
  return runPool({
    items: stmts,
    limit: (args.opts.concurrency as number | undefined) ?? stmts.length,
    stop: () => args.cancel.stopped() !== undefined,
    task: (child) => branch({ ...args, child, onError: onErrorOf(args.opts) }),
  });
}

/** `cancel` unless the block asked for `collect`, which is the documented default. */
function onErrorOf(opts: Record<string, unknown>): string {
  return (opts.onError as string | undefined) ?? "cancel";
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
 *
 * A failure is reported from here rather than from where the block ends, so
 * `collect` counts n failures as n and each of them keeps the branch it happened
 * in. A branch that is a step has already reported its own, and this adds
 * nothing to it.
 */
async function branch(args: BranchArgs): Promise<void> {
  try {
    await runStatement(branchEngine(args.engine, args.cancel), args.child, args.scope.child());
  } catch (error) {
    // Whatever ended this scope is not this branch's failure to report: it is
    // already being reported by whoever ended it, one level up or ten.
    if (error instanceof CancelSignal || error === args.cancel.stopped()) return;
    if (isControlSignal(error)) throw error;
    reportFailure({ engine: args.engine, error, span: nodeSpan(args.child, args.engine.uri) });
    args.failures.push(error);
    if (args.onError === "cancel") args.cancel.cancel(new CancelSignal());
  }
}

/**
 * One failure is raised as itself, so the reader sees the message the branch
 * produced. Several are raised together rather than one being picked.
 *
 * Either way the throw is claimed: every one of these is already counted and on
 * the stream, and what is left is only how the block ends.
 */
function report(failures: readonly unknown[]): void {
  if (failures.length === 0) return;
  const many = `${failures.length} parallel branches failed.`;
  const error = failures.length === 1 ? failures[0] : new AggregateError(failures, many);
  claim(error);
  throw error;
}
