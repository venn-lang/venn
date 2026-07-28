import { type ActionDefinition, type ActionInput, arg, Duration, defineAction, z } from "@venn/sdk";
import { t } from "@venn/types";
import { type SpikeProfile, spikeProfile } from "../profiles/index.js";

const spikeParams = z.object({ at: Duration.optional() });

/**
 * `load.spike 500 { at: "5s" }`.
 *
 * Describes a single burst to `peak` virtual users, `at` into the run. Nothing
 * runs until the profile is handed to `load.run`.
 *
 * @returns a `load.Spike` profile.
 */
export const spikeAction: ActionDefinition = defineAction({
  name: "spike",
  doc: "Build a spike load profile that peaks at `peak` VUs.",
  params: spikeParams.optional(),
  args: [arg("peak", t.number, "Virtual users at the top of the spike.")],
  result: t.ref("load.Spike"),
  run: (_ctx, input) => buildSpike(input),
});

function buildSpike(input: ActionInput<unknown>): SpikeProfile {
  const params = (input.params ?? {}) as { at?: number };
  return spikeProfile({ peak: Number(input.args[0] ?? 0), at: params.at });
}
