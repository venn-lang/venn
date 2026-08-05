import { definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import { httpActions } from "./actions/index.js";
import { httpMatchers } from "./matchers/index.js";
import { httpTypeDefs } from "./types.js";

/**
 * The `http` namespace: the request verbs, `http.serve`/`http.on`, the `header`
 * matcher and the types they trade in.
 *
 * Requires the `net` capability, so a host without it refuses the plugin at load
 * time rather than failing mid-flow. The compiler treats it exactly as it treats
 * a third-party plugin.
 */
export const httpPlugin: PluginDefinition = definePlugin({
  name: "venn/http",
  namespace: "http",
  requires: ["net"],
  actions: httpActions,
  matchers: httpMatchers,
  typeDefs: httpTypeDefs,
});
