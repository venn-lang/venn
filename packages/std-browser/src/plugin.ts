import { definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import { browserActions } from "./actions/index.js";
import { browserMatchers } from "./matchers/index.js";
import { browserTypeDefs } from "./types.js";

/**
 * The `@venn-lang/browser` plugin. Registers the `browser` namespace: sixteen verbs,
 * the `visible` and `text` matchers, the `Browser` and `Page` resources, and
 * the nominal types those hand around. Requires the `net` capability.
 */
export const browserPlugin: PluginDefinition = definePlugin({
  name: "venn/browser",
  namespace: "browser",
  requires: ["net"],
  actions: browserActions,
  matchers: browserMatchers,
  typeDefs: browserTypeDefs,
});

export { browserPlugin as default };
