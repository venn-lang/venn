/**
 * How a compiled block's steps are walked, and the three back edges a body has.
 *
 * Apart from what compiles them because this is where a body can be stopped:
 * every loop asks {@link stopIfTold} once per pass, which is the only moment a
 * synchronous body gives anything above it a say. A body with no loop in it runs
 * to its end, as it always could, since it is bounded by its own source.
 */

import { type Frame, isWaiting } from "../../expr/index.js";
import { truthy } from "../../value/index.js";
import type { Step } from "../compile.types.js";
import { stopIfTold } from "../stop-check.js";
import { BROKE, LEFT, RAN } from "./stopped.js";
import type { OverCount, OverItems, OverPasses } from "./walk-steps.types.js";

/** One pass of a loop, or `undefined` when the loop has no pass left to run. */
type Pass = (at: number) => number | Promise<number> | undefined;

/**
 * Run a block's steps until one of them stops.
 *
 * A statement that reached the world answers later than the one before it. The
 * statements behind it are chained onto its answer rather than run past it, so
 * a body reads in the order it was written: `let r = http.get(u)` has landed by
 * the time the next line asks what it changed.
 *
 * @param steps The block, compiled.
 * @param frame The call's storage.
 * @param from Where to pick the block up, which is how a chained tail resumes.
 * @returns Why the block ended: `RAN`, `LEFT`, `BROKE` or `WENT_ON`, or that
 * answer as a promise when a statement in it was slow.
 */
export function runSteps(steps: readonly Step[], frame: Frame, from = 0): number | Promise<number> {
  for (let at = from; at < steps.length; at += 1) {
    const stopped = (steps[at] as Step)(frame);
    if (isWaiting(stopped)) return behind({ waiting: stopped, steps, from: at + 1, frame });
    if (stopped !== RAN) return stopped;
  }
  return RAN;
}

/** The rest of a block, once the slow statement in front of it has answered. */
function behind(args: {
  waiting: Promise<number>;
  steps: readonly Step[];
  from: number;
  frame: Frame;
}): Promise<number> {
  const { waiting, steps, from, frame } = args;
  return waiting.then((stopped) => (stopped === RAN ? runSteps(steps, frame, from) : stopped));
}

/**
 * Passes of a loop, in order, each waiting for the one before it.
 *
 * Shared by all three loops because the back edge is the same in all three: a
 * pass that returned ends the loop and says so, a pass that broke ends it
 * quietly, and anything else goes round again.
 *
 * @param pass What one pass does, answering `undefined` when there is none left.
 * @param at Which pass to run, which is how a chained tail resumes.
 * @returns `LEFT` when a body returned, `RAN` otherwise.
 */
function eachPass(pass: Pass, at = 0): number | Promise<number> {
  for (let now = at; ; now += 1) {
    const stopped = pass(now);
    if (stopped === undefined) return RAN;
    if (isWaiting(stopped)) return stopped.then((settled) => afterPass(settled, pass, now));
    if (stopped === LEFT) return LEFT;
    if (stopped === BROKE) return RAN;
  }
}

/** What a slow pass decided, once it has decided it. */
function afterPass(stopped: number, pass: Pass, at: number): number | Promise<number> {
  if (stopped === LEFT) return LEFT;
  if (stopped === BROKE) return RAN;
  return eachPass(pass, at + 1);
}

/**
 * Each item of a `forEach` in turn.
 *
 * @param args The items, how the pass is named, and the body.
 * @param frame The call's storage.
 * @returns `LEFT` when the body returned, `RAN` otherwise, as a promise when a
 * pass was slow.
 * @throws Whatever ended the scope this body runs under.
 */
export function overItems(args: OverItems, frame: Frame): number | Promise<number> {
  return eachPass((at) => {
    if (at >= args.items.length) return undefined;
    stopIfTold();
    args.bind(frame, args.items[at]);
    return runSteps(args.body, frame);
  });
}

/**
 * The body of a `repeat`, `args.times` times.
 *
 * @param args How many passes, how the pass is numbered, and the body.
 * @param frame The call's storage.
 * @returns `LEFT` when the body returned, `RAN` otherwise, as a promise when a
 * pass was slow.
 * @throws Whatever ended the scope this body runs under.
 */
export function overCount(args: OverCount, frame: Frame): number | Promise<number> {
  return eachPass((at) => {
    if (at >= args.times) return undefined;
    stopIfTold();
    if (args.bind) args.bind(frame, at + 1);
    return runSteps(args.body, frame);
  });
}

/**
 * Round and round until the condition stops holding, or something stops it.
 *
 * The uncapped one, so this is the back edge that matters: a `loop { }` with no
 * condition ends only where its `break` is written, or where the scope around it
 * says the time is up.
 *
 * The condition is asked once per pass and may itself be slow, since it is an
 * expression like any other and may now reach the world. A pending answer is
 * waited for before the pass it decides, which is the only reading of `loop
 * more() { … }` a person would defend.
 *
 * @param args The condition, the body, and what a captured state re-boxes with.
 * @param frame The call's storage.
 * @returns `LEFT` when the body returned, `RAN` otherwise, as a promise when a
 * pass or a condition was slow.
 * @throws Whatever ended the scope this body runs under.
 */
export function overPasses(args: OverPasses, frame: Frame): number | Promise<number> {
  const { body, condition, fresh } = args;
  return eachPass(() => {
    const asked = condition ? condition(frame) : true;
    if (isWaiting(asked)) return asked.then((held) => onePass({ held, body, fresh }, frame));
    return truthy(asked) ? onePass({ held: asked, body, fresh }, frame) : undefined;
  });
}

/** One pass of a `loop`, once the condition it hangs on has answered. */
function onePass(
  args: { held: unknown; body: readonly Step[]; fresh?: (frame: Frame) => void },
  frame: Frame,
): number | Promise<number> {
  if (!truthy(args.held)) return BROKE;
  stopIfTold();
  if (args.fresh) args.fresh(frame);
  return runSteps(args.body, frame);
}
