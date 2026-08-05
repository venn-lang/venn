import { definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import { dateActions } from "./actions/date-actions.js";

/**
 * The `date` plugin: what a moment needs that it cannot know alone.
 *
 * A clock, a pattern, or a place on earth. What a moment answers about itself
 * is a member of it, in UTC, and stays in the kernel: `at.year`, `at.plus(2h)`.
 *
 * Requires `clock` because `date.now` reads `ClockPort`. Declaring nothing let
 * the plugin load on a host that offers no clock and fail at port bind partway
 * through a run, and it made `date.now` legal inside a `fn`, where a body that
 * answers differently on each call is not pure by any reading.
 *
 * `date.format` and `date.of` are handed the moment they work on and read no
 * clock, so they are refused in a `fn` for their namespace's sake rather than
 * their own. A capability belongs to a plugin and purity belongs to a verb; the
 * answer is to split the namespace, not to under-declare the clock.
 */
export const datePlugin: PluginDefinition = definePlugin({
  name: "venn/date",
  namespace: "date",
  requires: ["clock"],
  actions: dateActions,
});
