import type { MapLit, Problem } from "@venn-lang/core";
import { unknownOptions } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";

/**
 * Check the keys of an options map against the action's own schema.
 *
 * The runtime refuses an unknown key too, but only when the flow reaches that
 * line. Both read the same list and say the same sentence, so the editor can
 * mark the word before anything runs.
 */
export function checkOptions(args: {
  opts: MapLit | undefined;
  params: unknown;
  ctx: CheckContext;
}): Problem[] {
  return unknownOptions({ opts: args.opts, params: args.params, uri: args.ctx.uri });
}
