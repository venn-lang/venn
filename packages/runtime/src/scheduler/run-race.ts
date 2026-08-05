import { durationMs, type RaceStmt } from "@venn-lang/core";
import { type CancelScope, createCancelScope, unwind } from "../cancel/index.js";
import type { Scope } from "../scope/index.js";
import { reportAbandoned } from "./abandoned.js";
import { branchEngine } from "./branch-engine.js";
import type { Engine } from "./engine.types.js";
import { nodeSpan } from "./node-span.js";
import { readOptions } from "./read-options.js";
import { withTimeout } from "./run-attempts.js";
import { runStatement } from "./run-statements.js";
import { CancelSignal } from "./signals.js";

/**
 * `race { timeout: 10s } { … }`: the first branch to settle wins, the losers are
 * cancelled, and the block waits for them to stop before it returns.
 *
 * `timeout` is the same mechanism `@timeout` is, and not a second one: the
 * branches run inside a scope with that deadline on it. The option is written in
 * the specification twice and was read by nobody, so a race somebody had bounded
 * was not bounded at all.
 *
 * An empty body settles here rather than in `Promise.race([])`, which is pending
 * for ever: everything after it was silently deleted from the run, no
 * `run.finished` was ever emitted, and the process left with 0 because the event
 * loop had simply drained.
 */
export async function runRace(engine: Engine, stmt: RaceStmt, scope: Scope): Promise<void> {
  if (stmt.body.stmts.length === 0) return;
  const kind = "RaceStmt";
  const opts = await readOptions({ opts: stmt.opts, kind, scope, uri: engine.uri });
  await withTimeout({
    engine,
    timeoutMs: durationMs(opts.timeout),
    where: nodeSpan(stmt, engine.uri),
    run: (scoped) => branches(scoped, stmt, scope),
  });
}

/** The branches, under a scope of their own, and the wait for the losers to stop. */
async function branches(engine: Engine, stmt: RaceStmt, scope: Scope): Promise<void> {
  const cancel = createCancelScope({ parent: engine.cancel, clock: engine.clock });
  const running = stmt.body.stmts.map((child) =>
    Promise.resolve(runStatement(branchEngine(engine, cancel), child, scope.child())),
  );
  try {
    await Promise.race(running);
  } finally {
    await settleLosers({ engine, stmt, cancel, branches: running });
  }
}

/** The losers, called off and then waited for, so the block outlives none of them. */
async function settleLosers(args: {
  engine: Engine;
  stmt: RaceStmt;
  cancel: CancelScope;
  branches: readonly Promise<void>[];
}): Promise<void> {
  args.cancel.cancel(new CancelSignal());
  if (!(await unwind({ work: args.branches }))) {
    const where = nodeSpan(args.stmt, args.engine.uri);
    reportAbandoned({ engine: args.engine, title: LEFT_RUNNING, where });
  }
  args.cancel.release();
}

const LEFT_RUNNING = "This race was decided, and a losing branch did not stop.";
