import { definePlugin, type PluginDefinition } from "@venn/sdk";
import { browserActions } from "./actions/index.js";
import { browserMatchers } from "./matchers/index.js";
import { browserTypes } from "./plugin.types.js";
import { browserResources } from "./resources/index.js";
import { browserTypeDefs } from "./types.js";

/**
 * The `@venn/browser` plugin. Registers the `browser` namespace: sixteen verbs,
 * the `visible` and `text` matchers, the `Browser` and `Page` resources, and
 * the nominal types those hand around. Requires the `net` capability.
 */
export const browserPlugin: PluginDefinition = definePlugin({
  name: "@venn/browser",
  version: "0.0.0",
  namespace: "browser",
  requires: ["net"],
  actions: browserActions,
  matchers: browserMatchers,
  resources: browserResources,
  types: browserTypes,
  typeDefs: browserTypeDefs,
});

export { browserPlugin as default };
