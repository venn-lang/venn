import type { RaceStmt } from "@venn/core";
import type { Scope } from "../scope/index.js";
import { branchEngine } from "./branch-engine.js";
import type { Engine } from "./engine.types.js";
import { runStatement } from "./run-statements.js";

/** `race { … }`: the first branch to settle wins, the losers are cancelled. */
export async function runRace(engine: Engine, stmt: RaceStmt, scope: Scope): Promise<void> {
  const controller = new AbortController();
  const branches = stmt.body.stmts.map((child) =>
    Promise.resolve(runStatement(branchEngine(engine, controller.signal), child, scope.child())),
  );
  try {
    await Promise.race(branches);
  } finally {
    controller.abort();
    // The losers reject with CancelSignal once they reach a statement boundary.
    for (const branch of branches) branch.catch(() => {});
  }
}
