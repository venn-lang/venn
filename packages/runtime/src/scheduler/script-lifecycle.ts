import type { Document } from "@venn-lang/core";
import type { Scope } from "../scope/index.js";
import { collectHooks } from "./collect.js";
import type { Engine } from "./engine.types.js";
import { runHooks } from "./run-lifecycle.js";
import type { Teardown } from "./run-prologue.js";
import { runTeardowns } from "./run-prologue.js";

/**
 * The program's `setup`, run before its first statement.
 *
 * It reads what the file declared, its functions, rather than what its
 * statements bind, because none of them has run yet. A `setup` that wants a
 * connection opens one.
 */
export async function runSetup(args: {
  engine: Engine;
  doc: Document;
  scope: Scope;
}): Promise<void> {
  await runHooks({ engine: args.engine, hooks: collectHooks(args.doc).setup, scope: args.scope });
}

/** What the program will do on the way out, filled in as the program runs. */
export interface Ending {
  /** Cleanups the statements deferred, in the order they were written. */
  readonly deferred: Teardown[];
}

/**
 * Say how the program ends, before it starts.
 *
 * Registered up front because the ending has to be in place for an interrupt
 * that arrives mid-statement, while what it runs is decided later, as the
 * statements defer things. One entry rather than one per `defer`, so the order
 * is stated here instead of falling out of a stack: `teardown` first, while the
 * connections it needs are still open, then the deferred work in reverse.
 */
export function registerEnding(args: { engine: Engine; doc: Document; scope: Scope }): Ending {
  const ending: Ending = { deferred: [] };
  const teardown = collectHooks(args.doc).teardown;
  args.engine.cleanup.add(async () => {
    await runHooks({ engine: args.engine, hooks: teardown, scope: args.scope });
    // Raised rather than kept, so the host hears it: a program that could not
    // hand back what it was holding has not ended well, and by this point the
    // run's own tally has already been reported.
    const failures = await runTeardowns(ending.deferred);
    if (failures.length > 0) throw failures[0];
  });
  return ending;
}
