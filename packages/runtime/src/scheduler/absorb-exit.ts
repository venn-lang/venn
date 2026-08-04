import type { Engine } from "./engine.types.js";
import { release } from "./report-failure.js";
import { ExitSignal } from "./signals.js";

/**
 * Run `body`, letting an `exit` end it.
 *
 * The exit code travels on the engine rather than on the throw, so whatever
 * wraps this still finishes the way it always does: teardowns run, `run.finished`
 * is emitted, and the host reads one number off the result. Any other error keeps
 * unwinding untouched.
 */
export async function absorbExit(engine: Engine, body: () => Promise<void>): Promise<void> {
  try {
    await body();
  } catch (error) {
    if (!(error instanceof ExitSignal)) throw error;
    // The propagation ends here, so a later throw of the same object is a
    // failure of its own rather than a repeat of this one.
    release(error);
    engine.exit = error.code;
  }
}
