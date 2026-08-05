import { definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import { jsonActions } from "./actions/json-actions.js";

/**
 * The `json` plugin: text into a value.
 *
 * Pure, so it needs no host capability and runs anywhere the language does, the
 * editor included. The other direction is `fmt.json`: this namespace reads and
 * that one writes, and neither knows how to do the other's half.
 */
export const jsonPlugin: PluginDefinition = definePlugin({
  name: "venn/json",
  namespace: "json",
  actions: jsonActions,
});
