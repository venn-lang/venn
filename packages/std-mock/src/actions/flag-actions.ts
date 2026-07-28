import { type ActionDefinition, type ActionInput, arg, defineAction, z } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { getMockState } from "../state/index.js";

/**
 * `mock.flag("new-checkout", { value: "b" })`: set a feature flag.
 *
 * The flag's value is an option rather than a second positional argument, so
 * the common case, turning a flag on, reads as `mock.flag("new-checkout")`.
 */
export const flag: ActionDefinition = defineAction({
  name: "flag",
  doc: "Set a feature flag; the value comes from opts or defaults to true.",
  params: z.object({ value: z.unknown().optional() }).optional(),
  args: [arg("name", t.string, "Which flag. Its value is an option, true by default.")],
  result: t.dynamic,
  run: (_ctx, input) => setFlag(input),
});

function setFlag(input: ActionInput<unknown>): unknown {
  const params = (input.params ?? {}) as { value?: unknown };
  const name = String(input.args[0] ?? "");
  const value = params.value ?? true;
  getMockState().flags.set(name, value);
  return value;
}
