import type { Engine } from "./engine.types.js";

/**
 * A per-branch view of the engine carrying the cancellation signal.
 *
 * Into `ctx` as well as onto the engine: the statement walker checks the signal
 * between statements, but a branch parked inside a long action is only reachable
 * through the context the action was handed. Without it, cancelling a branch
 * waits for whatever it is already doing to finish on its own.
 */
export function branchEngine(engine: Engine, signal: AbortSignal): Engine {
  return { ...engine, signal, ctx: { ...engine.ctx, signal } };
}
