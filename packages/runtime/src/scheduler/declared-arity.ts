import type { ActionDefinition } from "@venn-lang/sdk";
import { paramSpecs } from "@venn-lang/sdk";

/**
 * How many positional arguments a verb declared.
 *
 * Used to tell an argument that happens to be a map from the options map that
 * configures the call. A variadic verb such as `data.oneOf a b c` takes every
 * argument it is given, so nothing is left over to mistake for configuration.
 */
export function takes(action: ActionDefinition): number {
  if (action.args?.some((each) => each.rest)) return Number.POSITIVE_INFINITY;
  return action.args?.length ?? action.signature?.params.length ?? 0;
}

/**
 * Which keys a verb accepts in its options map.
 *
 * The other half of telling an argument from the configuration: a trailing map
 * writing only names the verb declared is the configuration, however many
 * positionals came before it.
 *
 * @param action The verb the call resolved to.
 * @returns The declared names, `true` for a schema that welcomes any key, and
 * `false` for a verb that takes no options at all.
 */
export function optionNames(action: ActionDefinition): readonly string[] | boolean {
  if (!action.params) return false;
  const specs = paramSpecs(action.params);
  return specs.length === 0 ? true : specs.map((spec) => spec.name);
}
