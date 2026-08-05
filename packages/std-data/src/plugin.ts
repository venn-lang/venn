import { definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import { dataActions } from "./actions/index.js";
import { dataTypeDefs } from "./types.js";

/**
 * The `data` plugin: deterministic test-data generators.
 *
 * Every verb draws from the run's `Random`, the same stream `math.random` uses,
 * which the runner hands back at the start of every flow. That is what makes a
 * flow's values its own: they no longer depend on which flows ran before it,
 * and a host that records the seed can replay the run. Nothing here does I/O,
 * so `random` is the one capability it asks for.
 */
export const dataPlugin: PluginDefinition = definePlugin({
  name: "venn/data",
  namespace: "data",
  requires: ["random"],
  actions: dataActions,
  typeDefs: dataTypeDefs,
});
