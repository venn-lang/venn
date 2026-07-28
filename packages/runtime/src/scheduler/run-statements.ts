import type {
  ActionCall,
  CaptureStmt,
  ExpectStmt,
  ForEachStmt,
  GroupDecl,
  IfStmt,
  LetStmt,
  ParallelStmt,
  RaceStmt,
  RepeatStmt,
  ReturnStmt,
  RunStmt,
  Statement,
  StepDecl,
  TryStmt,
  WhileStmt,
} from "@venn/core";
import type { Scope } from "../scope/index.js";
import type { Engine } from "./engine.types.js";
import type { Pending } from "./pending.types.js";
import { runActionStatement } from "./run-action.js";
import { runCapture, runLet, runReturn } from "./run-bindings.js";
import { runExpect } from "./run-expect.js";
import { runForEach } from "./run-foreach.js";
import { runGroup } from "./run-group.js";
import { runIf } from "./run-if.js";
import { runParallel } from "./run-parallel.js";
import { runRace } from "./run-race.js";
import { runRepeat } from "./run-repeat.js";
import { runRun } from "./run-run.js";
import { runStep } from "./run-step.js";
import { runTry } from "./run-try.js";
import { runWhile } from "./run-while.js";
import { BreakSignal, CancelSignal, ContinueSignal } from "./signals.js";

/** Run a block's statements in order. */
export async function runStatements(
  engine: Engine,
  stmts: readonly Statement[],
  scope: Scope,
): Promise<void> {
  for (const stmt of stmts) {
    const pending = runStatement(engine, stmt, scope);
    if (pending) await pending;
  }
}

/**
 * Dispatch one statement to its handler. This is the single boundary where a
 * cancelled `race` branch stops advancing.
 *
 * Switched on `$type`, not on the `isXxx` guards: each guard asks Langium's
 * reflection whether one type is a subtype of another, and a chain of them costs
 * a double-digit share of a large `forEach`. `$type` is a plain string every
 * node carries, so one switch answers what thirteen questions would.
 */
export function runStatement(engine: Engine, stmt: Statement, scope: Scope): Pending {
  if (engine.signal?.aborted) throw new CancelSignal();
  switch (stmt.$type) {
    case "LetStmt":
      return runLet(engine, stmt as LetStmt, scope);
    case "ActionCall":
      return runActionStatement(engine, stmt as ActionCall, scope);
    case "ExpectStmt":
      return runExpect(engine, stmt as ExpectStmt, scope);
    case "IfStmt":
      return runIf(engine, stmt as IfStmt, scope);
    case "StepDecl":
      return runStep(engine, stmt as StepDecl, scope);
    case "GroupDecl":
      return runGroup(engine, stmt as GroupDecl, scope);
    default:
      return control(engine, stmt, scope);
  }
}

/** Loops, concurrency and the control-flow signals: the rarer half. */
function control(engine: Engine, stmt: Statement, scope: Scope): Pending {
  switch (stmt.$type) {
    case "ForEachStmt":
      return runForEach(engine, stmt as ForEachStmt, scope);
    case "RepeatStmt":
      return runRepeat(engine, stmt as RepeatStmt, scope);
    case "WhileStmt":
      return runWhile(engine, stmt as WhileStmt, scope);
    case "ParallelStmt":
      return runParallel(engine, stmt as ParallelStmt, scope);
    case "RaceStmt":
      return runRace(engine, stmt as RaceStmt, scope);
    case "TryStmt":
      return runTry(engine, stmt as TryStmt, scope);
    case "RunStmt":
      return runRun(engine, stmt as RunStmt, scope);
    default:
      return leaf(stmt, scope);
  }
}

function leaf(stmt: Statement, scope: Scope): Pending {
  if (stmt.$type === "CaptureStmt") return runCapture(stmt as CaptureStmt, scope);
  if (stmt.$type === "ReturnStmt") return runReturn(stmt as ReturnStmt, scope);
  if (stmt.$type === "BreakStmt") throw new BreakSignal();
  if (stmt.$type === "ContinueStmt") throw new ContinueSignal();
  // LifecycleDecl (on/defer) is handled by runBlock / runFlow, not here.
  return undefined;
}
