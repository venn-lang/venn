import { definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import { loadActions } from "./actions/index.js";
import { loadTypeDefs } from "./types.js";

/**
 * The `@venn-lang/load` plugin. Registers the `load` namespace: three profile
 * builders, the `run` verb that executes one, and the profile and metrics
 * types. Requires the `net` capability, since a run drives real traffic.
 */
export const loadPlugin: PluginDefinition = definePlugin({
  name: "venn/load",
  namespace: "load",
  requires: ["net"],
  actions: loadActions,
  typeDefs: loadTypeDefs,
});
