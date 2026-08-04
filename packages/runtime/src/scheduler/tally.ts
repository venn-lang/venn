import type { Engine } from "./engine.types.js";
import type { Tally } from "./tally.types.js";

/**
 * A frame that wants a verdict of its own, and the tally that gives it one.
 *
 * The tally hangs off the engine beside `cancel`, and is forked the same way: a
 * branch spreads the engine it was handed, so a sibling's tally is never in this
 * chain and a sibling's failure can never reach this frame.
 *
 * @param engine The frame this one was reached through.
 * @returns The engine to run the frame on, and the tally its verdict is read from.
 */
export function scopeTally(engine: Engine): { engine: Engine; tally: Tally } {
  const tally: Tally = { count: 0, parent: engine.tally };
  return { engine: { ...engine, tally }, tally };
}

/**
 * Count one failure against every frame it happened inside, and against the run.
 *
 * @param engine The frame that owns the failure.
 */
export function countFailure(engine: Engine): void {
  for (let at = engine.tally; at !== undefined; at = at.parent) at.count += 1;
  engine.result.failed += 1;
}

/**
 * Give back failures a frame is no longer answerable for: a `@retry` attempt
 * being thrown away, or a `@flaky` node forgiven at the end of the run.
 *
 * Only what this frame counted, walked back out of the chain that counted it.
 * Assigning a remembered total back over the run's counter is what erased a
 * sibling's failure and left a red run reporting green.
 *
 * @param engine The frame giving them back.
 * @param count How many.
 */
export function forget(engine: Engine, count: number): void {
  if (count <= 0) return;
  for (let at = engine.tally; at !== undefined; at = at.parent) {
    at.count = Math.max(0, at.count - count);
  }
  engine.result.failed = Math.max(0, engine.result.failed - count);
}
