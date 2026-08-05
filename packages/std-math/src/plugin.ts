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
 *
 * Requires `random` because `randomActions` is in the list: `math.random` and
 * `math.randomInt` draw from `RandomPort`. Declaring nothing was a live defect
 * rather than a tidy omission. On a host without `random` this loaded clean and
 * then died at port bind mid-run, which is the failure the capability model
 * exists to turn into a load-time refusal, and `requires` is also what decides
 * whether a `fn` may call a verb, so an empty list made `math.randomInt` legal
 * inside something the language calls pure.
 *
 * The cost is that `math.sqrt` and every other function here is refused in a
 * `fn` too, though it touches nothing. A capability is declared per plugin
 * while purity is a property of each verb, so a plugin holding both loses the
 * pure half. The answer is to split the namespace, and `randomActions` already
 * sits in its own file.
 */
export const mathPlugin: PluginDefinition = definePlugin({
  name: "venn/math",
  namespace: "math",
  requires: ["random"],
  actions: [...functions, ...checks, ...randomActions],
  values: constants,
});
