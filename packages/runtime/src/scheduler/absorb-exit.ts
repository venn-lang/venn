import type { Engine } from "./engine.types.js";
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
    engine.exit = error.code;
  }
}
