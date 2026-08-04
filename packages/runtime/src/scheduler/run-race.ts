import type { RaceStmt } from "@venn-lang/core";
import { createCancelScope, unwind } from "../cancel/index.js";
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
 */
export async function runRace(engine: Engine, stmt: RaceStmt, scope: Scope): Promise<void> {
  const cancel = createCancelScope({ parent: engine.cancel, clock: engine.clock });
  const branches = stmt.body.stmts.map((child) =>
    Promise.resolve(runStatement(branchEngine(engine, cancel), child, scope.child())),
  );
  try {
    await Promise.race(branches);
  } finally {
    cancel.cancel(new CancelSignal());
    if (!(await unwind({ work: branches }))) {
      reportAbandoned({ engine, title: LEFT_RUNNING, where: nodeSpan(stmt, engine.uri) });
    }
    cancel.release();
  }
}

const LEFT_RUNNING = "This race was decided, and a losing branch did not stop.";
