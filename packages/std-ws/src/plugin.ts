import { definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import { wsActions } from "./actions/index.js";
import { wsMatchers } from "./matchers/index.js";
import { messageSchema, wsTypeDefs } from "./types/index.js";

/**
 * The `ws` namespace: `connect`, `send`, `expect`, `close`, the `type` matcher
 * and the `ws.Message` type.
 *
 * Requires the `net` capability, so a host without it refuses the plugin at load
 * time rather than failing mid-flow.
 */
export const wsPlugin: PluginDefinition = definePlugin({
  name: "venn/ws",
  version: "0.0.0",
  namespace: "ws",
  requires: ["net"],
  actions: wsActions,
  matchers: wsMatchers,
  types: { Message: messageSchema },
  typeDefs: wsTypeDefs,
});
