import { definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import { dataActions } from "./actions/index.js";
import { dataTypeDefs } from "./types.js";

/**
 * The `data` plugin: pure, deterministic test-data generators.
 *
 * Every verb draws from a seeded module-level PRNG, so the same script replays the
 * same values. Nothing here does I/O, so there is no capability and no port to bind.
 */
export const dataPlugin: PluginDefinition = definePlugin({
  name: "venn/data",
  version: "0.0.0",
  namespace: "data",
  actions: dataActions,
  typeDefs: dataTypeDefs,
});
