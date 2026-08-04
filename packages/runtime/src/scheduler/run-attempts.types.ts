import type { Span } from "@venn-lang/core";
import type { Engine } from "./engine.types.js";

/**
 * A body that runs under whatever cancellation scope it is handed.
 *
 * The engine is a parameter rather than something the caller closed over,
 * because a body that closed over the engine it was written with could never be
 * reached by the scope the timeout made for it.
 */
export type Scoped = (engine: Engine) => Promise<void>;

/** What `@timeout(…)`, and `race { timeout: … }`, need to bound a body. */
export interface TimeoutArgs {
  engine: Engine;
  /** How long the body has, or `undefined` for no bound at all. */
  timeoutMs: number | undefined;
  /** Where the bound is written, for what is said when the body will not stop. */
  where: Span;
  run: Scoped;
}
