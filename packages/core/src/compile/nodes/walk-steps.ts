/**
 * How a compiled block's steps are walked, and the three back edges a body has.
 *
 * Apart from what compiles them because this is where a body can be stopped:
 * every loop asks {@link stopIfTold} once per pass, which is the only moment a
 * synchronous body gives anything above it a say. A body with no loop in it runs
 * to its end, as it always could, since it is bounded by its own source.
 */

import type { Frame } from "../../expr/index.js";
import { truthy } from "../../value/index.js";
import type { Step } from "../compile.types.js";
import { stopIfTold } from "../stop-check.js";
import { BROKE, LEFT, RAN } from "./stopped.js";
import type { OverCount, OverItems, OverPasses } from "./walk-steps.types.js";

/**
 * Run a block's steps until one of them stops.
 *
 * @param steps The block, compiled.
 * @param frame The call's storage.
 * @returns Why the block ended: `RAN`, `LEFT`, `BROKE` or `WENT_ON`.
 */
export function runSteps(steps: readonly Step[], frame: Frame): number {
  for (const step of steps) {
    const stopped = step(frame);
    if (stopped !== RAN) return stopped;
  }
  return RAN;
}

/**
 * Each item of a `forEach` in turn.
 *
 * @param args The items, how the pass is named, and the body.
 * @param frame The call's storage.
 * @returns `LEFT` when the body returned, `RAN` otherwise.
 * @throws Whatever ended the scope this body runs under.
 */
export function overItems(args: OverItems, frame: Frame): number {
  for (const item of args.items) {
    stopIfTold();
    args.bind(frame, item);
    const stopped = runSteps(args.body, frame);
    if (stopped === LEFT) return LEFT;
    if (stopped === BROKE) break;
  }
  return RAN;
}

/**
 * The body of a `repeat`, `args.times` times.
 *
 * @param args How many passes, how the pass is numbered, and the body.
 * @param frame The call's storage.
 * @returns `LEFT` when the body returned, `RAN` otherwise.
 * @throws Whatever ended the scope this body runs under.
 */
export function overCount(args: OverCount, frame: Frame): number {
  for (let at = 1; at <= args.times; at += 1) {
    stopIfTold();
    if (args.bind) args.bind(frame, at);
    const stopped = runSteps(args.body, frame);
    if (stopped === LEFT) return LEFT;
    if (stopped === BROKE) break;
  }
  return RAN;
}

/**
 * Round and round until the condition stops holding, or something stops it.
 *
 * The uncapped one, so this is the back edge that matters: a `loop { }` with no
 * condition ends only where its `break` is written, or where the scope around it
 * says the time is up.
 *
 * @param args The condition, the body, and what a captured state re-boxes with.
 * @param frame The call's storage.
 * @returns `LEFT` when the body returned, `RAN` otherwise.
 * @throws Whatever ended the scope this body runs under.
 */
export function overPasses(args: OverPasses, frame: Frame): number {
  const { body, condition, fresh } = args;
  while (!condition || truthy(condition(frame))) {
    stopIfTold();
    if (fresh) fresh(frame);
    const stopped = runSteps(body, frame);
    if (stopped === LEFT) return LEFT;
    if (stopped === BROKE) break;
  }
  return RAN;
}
