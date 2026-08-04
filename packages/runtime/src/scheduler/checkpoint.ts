import { setStopCheck } from "@venn-lang/core";
import type { Engine } from "./engine.types.js";

/**
 * The boundary between two pieces of work: the one place a run is stopped.
 *
 * Two things, because they are one rule and used to be written out in seven
 * places: the walk refuses to take another step once the scope has ended, and
 * the scope is handed to the compiled bodies this step may call. A `fn` runs
 * synchronously, so from here until the step gives control back nothing else can
 * be running, and the check it reads is this scope's and no other's.
 *
 * @param engine The engine whose scope is in force here.
 * @throws Whatever ended the scope: a `VN8001` timeout, or the reason a `race`
 * or a `parallel` called its branches off.
 */
export function checkpoint(engine: Engine): void {
  const stopped = engine.cancel?.stopped;
  setStopCheck(stopped);
  const stop = stopped?.();
  if (stop !== undefined) throw stop;
}
