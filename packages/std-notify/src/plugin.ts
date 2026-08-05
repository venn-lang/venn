import { definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import { notifyActions } from "./actions/index.js";
import { notifyTypeDefs } from "./types.js";

/**
 * The `@venn-lang/notify` plugin. Registers the `notify` namespace: the `slack`,
 * `webhook` and `email` verbs and the nominal `notify.Receipt` type. Requires
 * the `net` capability, since every verb dispatches over the network.
 */
export const notifyPlugin: PluginDefinition = definePlugin({
  name: "venn/notify",
  namespace: "notify",
  requires: ["net"],
  actions: notifyActions,
  typeDefs: notifyTypeDefs,
});

export { notifyPlugin as default };
