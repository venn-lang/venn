import { definePlugin, type PluginDefinition } from "@venn/sdk";
import { mqttActions } from "./actions/index.js";
import { mqttMatchers } from "./matchers/index.js";
import { messageSchema, mqttTypeDefs } from "./types/index.js";

/**
 * The `mqtt` namespace: `connect`, `publish`, `subscribe`, `expect`, the `topic`
 * matcher and the `mqtt.Message` type.
 *
 * Requires the `net` capability, so a host without it refuses the plugin at load
 * time rather than failing mid-flow.
 */
export const mqttPlugin: PluginDefinition = definePlugin({
  name: "@venn/mqtt",
  version: "0.0.0",
  namespace: "mqtt",
  requires: ["net"],
  actions: mqttActions,
  matchers: mqttMatchers,
  types: { Message: messageSchema },
  typeDefs: mqttTypeDefs,
});
