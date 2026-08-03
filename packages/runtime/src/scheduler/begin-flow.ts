import { RandomPort } from "@venn-lang/contracts";
import type { Engine } from "./engine.types.js";

/**
 * What a flow is handed at its start: a random stream from the top, and
 * whatever a plugin kept between calls.
 *
 * A flow that reads a generated value has to read the same one whether it ran
 * alone, after another flow, or under `--flow`. The stream and the plugin state
 * are the two things that used to survive a flow and decide the next one's
 * answers, so the flow is where both are given back.
 *
 * @param engine The run in progress. Nothing is read but the ports and the
 * plugins it loaded.
 */
export function beginFlow(engine: Engine): void {
  engine.ctx.port(RandomPort).restart();
  for (const plugin of engine.plugins ?? []) plugin.atFlowStart?.();
}
