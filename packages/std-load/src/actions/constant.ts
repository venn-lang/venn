import {
  type ActionDefinition,
  type ActionInput,
  arg,
  Duration,
  defineAction,
  z,
} from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { type ConstantProfile, constantProfile } from "../profiles/index.js";

const constantParams = z.object({ over: Duration.optional() });

/**
 * `load.constant 50 { over: "10s" }`.
 *
 * Describes a flat load: `vus` virtual users held steady for `over`. Nothing
 * runs until the profile is handed to `load.run`.
 *
 * @returns a `load.Constant` profile.
 */
export const constantAction: ActionDefinition = defineAction({
  name: "constant",
  doc: "Build a constant-VUs load profile.",
  params: constantParams.optional(),
  args: [arg("vus", t.number, "How many virtual users, held steady.")],
  result: t.ref("load.Constant"),
  run: (_ctx, input) => buildConstant(input),
});

function buildConstant(input: ActionInput<unknown>): ConstantProfile {
  const params = (input.params ?? {}) as { over?: number };
  return constantProfile({ vus: Number(input.args[0] ?? 0), over: params.over });
}
