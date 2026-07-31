import { definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import { checks } from "./actions/checks.js";
import { constants } from "./actions/constants.js";
import { functions } from "./actions/functions.js";
import { randomActions } from "./actions/random-actions.js";

/**
 * The `math` plugin: the constants and functions a number has no member for.
 *
 * Everything here either has no receiver at all, such as `pi`, or takes two
 * numbers neither of which is the subject, such as `atan2`. What a number can
 * answer about itself stays a member: `x.abs`, `x.sqrt`, `x.round(2)`.
 */
export const mathPlugin: PluginDefinition = definePlugin({
  name: "venn/math",
  version: "0.0.0",
  namespace: "math",
  actions: [...functions, ...checks, ...randomActions],
  values: constants,
});
