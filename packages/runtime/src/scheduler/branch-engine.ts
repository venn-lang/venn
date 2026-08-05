import type { CancelScope } from "../cancel/index.js";
import type { Engine } from "./engine.types.js";

/**
 * A view of the engine running under `scope`.
 *
 * Onto `ctx` as well as onto the engine: the statement walker reads the scope
 * between statements, but a branch parked inside a long action is only reachable
 * through the context the action was handed. Without it, cancelling a branch
 * waits for whatever it is already doing to finish on its own.
 *
 * `undefined` detaches instead, which is what cleanup needs: a `defer` giving
 * back what a cancelled branch was holding has to be able to reach the world,
 * and the signal its branch was cancelled with would refuse it the request.
 */
export function branchEngine(engine: Engine, scope: CancelScope | undefined): Engine {
  return { ...engine, cancel: scope, ctx: { ...engine.ctx, signal: scope?.signal } };
}

/**
 * The engine cleanup runs on: this one, with the cancel scope taken off it.
 *
 * A `teardown` or a `defer` is written for the case its block did not reach the
 * end, and cancellation is that case. Left on the engine its block ran on, the
 * first `checkpoint` in the cleanup body throws the reason the block was called
 * off, so the very hook that gives the resource back is the one statement that
 * never runs, and the timeout that stopped the block is counted a second time as
 * a `VN7004` against the hook. Detaching also takes the aborted signal off the
 * context an action reads, which is the only way cleanup can still reach the
 * world it is handing back.
 */
export function cleanupEngine(engine: Engine): Engine {
  return branchEngine(engine, undefined);
}
