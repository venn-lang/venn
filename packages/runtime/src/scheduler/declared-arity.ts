import type { ActionDefinition } from "@venn/sdk";

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
