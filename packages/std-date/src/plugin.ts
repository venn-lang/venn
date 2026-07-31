import { definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import { dateActions } from "./actions/date-actions.js";

/**
 * The `date` plugin: what a moment needs that it cannot know alone.
 *
 * A clock, a pattern, or a place on earth. What a moment answers about itself
 * is a member of it, in UTC, and stays in the kernel: `at.year`, `at.plus(2h)`.
 */
export const datePlugin: PluginDefinition = definePlugin({
  name: "venn/date",
  version: "0.0.0",
  namespace: "date",
  actions: dateActions,
});
