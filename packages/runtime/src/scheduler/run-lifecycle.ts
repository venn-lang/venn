import type { LifecycleDecl } from "@venn-lang/core";
import type { Scope } from "../scope/index.js";
import type { Engine } from "./engine.types.js";
import { runCleanup } from "./run-cleanup.js";
import { ExitSignal } from "./signals.js";

/**
 * Run a set of lifecycle blocks (setup/teardown/beforeEach/afterEach) in order.
 *
 * The caller passes the scope the hooks belong to (the suite root for
 * setup/teardown, the flow's own scope for beforeEach/afterEach) and each body
 * runs in a child of it, the way the `on` handlers below do. In a parentless
 * scope `env`, the prelude and the top-level bindings would
 * all read as undefined and the hook would run anyway: a teardown written as
 * `db.exec "DELETE FROM orders WHERE run = '${env.RUN_ID}'"` deletes the table
 * it was meant to tidy.
 */
export async function runHooks(args: {
  engine: Engine;
  hooks: readonly LifecycleDecl[];
  scope: Scope;
}): Promise<void> {
  for (const hook of args.hooks) await runHook(args.engine, hook, args.scope);
}

/**
 * Run the `on <event>` handlers whose event matches (e.g. "failure"/"success").
 *
 * Through the same boundary as the hooks above: a handler that reacts to a
 * failure by failing itself is a second failure, not the end of the run.
 */
export async function runOnHandlers(args: {
  engine: Engine;
  handlers: readonly LifecycleDecl[];
  event: string;
  scope: Scope;
}): Promise<void> {
  for (const handler of args.handlers) {
    if (handler.event === args.event) await runHook(args.engine, handler, args.scope);
  }
}

/**
 * A hook that throws fails the suite instead of ending the run: it is counted
 * and reported, and the walk carries on to `run.finished`, so the reporters
 * still close their files and the files after this one still run.
 */
async function runHook(engine: Engine, hook: LifecycleDecl, scope: Scope): Promise<void> {
  try {
    await runCleanup(engine, hook, scope);
  } catch (error) {
    // Read as a flow body reads it: `break`/`return` unwind, they do not fail.
    // `exit` is not the hook's to absorb: it ends the run, and the code it
    // carries is the whole verdict, so it keeps unwinding to whoever ends it.
    if (error instanceof ExitSignal) throw error;
  }
}
