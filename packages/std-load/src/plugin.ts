import { definePlugin, type PluginDefinition } from "@venn/sdk";
import { loadActions } from "./actions/index.js";
import { LoadMetricsSchema } from "./metrics/index.js";
import { loadTypeDefs } from "./types.js";

/**
 * The `@venn/load` plugin. Registers the `load` namespace: three profile
 * builders, the `run` verb that executes one, and the profile and metrics
 * types. Requires the `net` capability, since a run drives real traffic.
 */
export const loadPlugin: PluginDefinition = definePlugin({
  name: "@venn/load",
  version: "0.0.0",
  namespace: "load",
  requires: ["net"],
  actions: loadActions,
  types: { LoadMetrics: LoadMetricsSchema },
  typeDefs: loadTypeDefs,
});
