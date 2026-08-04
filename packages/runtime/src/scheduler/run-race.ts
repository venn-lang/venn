import type { RaceStmt } from "@venn-lang/core";
import { type CancelScope, createCancelScope, unwind } from "../cancel/index.js";
import type { Scope } from "../scope/index.js";
import { reportAbandoned } from "./abandoned.js";
import { branchEngine } from "./branch-engine.js";
import type { Engine } from "./engine.types.js";
import { nodeSpan } from "./node-span.js";
import { runStatement } from "./run-statements.js";
import { CancelSignal } from "./signals.js";

/**
 * `race { … }`: the first branch to settle wins, and the losers are cancelled.
 *
 * The block waits for the losers to actually stop before it returns. Aborting
 * and walking away is what let a loser's `defer` run after `teardown` had closed
 * what it depended on, and its assertions land after the run was tallied.
 *
 * An empty body settles here rather than in `Promise.race([])`, which is pending
 * for ever: everything after it was silently deleted from the run, no
 * `run.finished` was ever emitted, and the process left with 0 because the event
 * loop had simply drained.
 */
export async function runRace(engine: Engine, stmt: RaceStmt, scope: Scope): Promise<void> {
  if (stmt.body.stmts.length === 0) return;
  const cancel = createCancelScope({ parent: engine.cancel, clock: engine.clock });
  const branches = stmt.body.stmts.map((child) =>
    Promise.resolve(runStatement(branchEngine(engine, cancel), child, scope.child())),
  );
  try {
    await Promise.race(branches);
  } finally {
    await settleLosers({ engine, stmt, cancel, branches });
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
