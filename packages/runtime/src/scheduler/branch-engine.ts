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
