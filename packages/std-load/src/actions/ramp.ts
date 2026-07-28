import { type ActionDefinition, type ActionInput, arg, Duration, defineAction, z } from "@venn/sdk";
import { t } from "@venn/types";
import { type RampProfile, rampProfile } from "../profiles/index.js";

const rampParams = z.object({ over: Duration.optional(), hold: Duration.optional() });

/**
 * `load.ramp 0 200 { over: "30s", hold: "5m" }`.
 *
 * Describes a climb from `from` to `to` virtual users across `over`, then held
 * at `to` for `hold`. Nothing runs until the profile is handed to `load.run`.
 *
 * The grammar has no `0 -> 200` arrow sugar, so the two ends are separate
 * positional arguments. `over` and `hold` accept `"30s"` or a millisecond count.
 *
 * @returns a `load.Ramp` profile.
 */
export const rampAction: ActionDefinition = defineAction({
  name: "ramp",
  doc: "Build a ramp load profile from `from` to `to` VUs.",
  params: rampParams.optional(),
  args: [
    arg("from", t.number, "Virtual users at the start."),
    arg("to", t.number, "Virtual users at the end."),
  ],
  result: t.ref("load.Ramp"),
  run: (_ctx, input) => buildRamp(input),
});

function buildRamp(input: ActionInput<unknown>): RampProfile {
  const params = (input.params ?? {}) as { over?: number; hold?: number };
  return rampProfile({
    from: Number(input.args[0] ?? 0),
    to: Number(input.args[1] ?? 0),
    over: params.over,
    hold: params.hold,
  });
}
