import { RandomPort } from "@venn-lang/contracts";
import type { ActionContext } from "@venn-lang/sdk";
import type { Rng } from "./rng.types.js";

/**
 * The stream this run draws from.
 *
 * Every generator used to read a module-level PRNG, so the position was the
 * process's rather than the run's: the same flow answered differently depending
 * on which flows had gone before it, and no host could seed it. The run's
 * `Random` is one stream with one owner, and the runner hands it back at the
 * start of every flow.
 *
 * @param ctx What the verb's `run` was given.
 * @returns A draw of the next float in [0, 1).
 * @throws VennError `VN2010` when the host offers no `random` capability.
 */
export function rngFrom(ctx: ActionContext): Rng {
  const random = ctx.port(RandomPort);
  return () => random.next();
}
