import { caughtValue, type TryStmt } from "@venn-lang/core";
import type { Scope } from "../scope/index.js";
import type { Engine } from "./engine.types.js";
import { runBlock } from "./run-block.js";
import { isControlSignal } from "./signals.js";

/** `try { } catch e { } finally { }`: control signals pass through, errors go to catch. */
export async function runTry(engine: Engine, stmt: TryStmt, scope: Scope): Promise<void> {
  try {
    await runBlock(engine, stmt.body, scope.child());
  } catch (error) {
    if (isControlSignal(error)) throw error;
    await runCatch({ engine, stmt, scope, error });
  } finally {
    if (stmt.finalizer) await runBlock(engine, stmt.finalizer, scope.child());
  }
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
