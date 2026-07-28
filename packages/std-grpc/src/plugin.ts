import { definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import { grpcActions } from "./actions/index.js";
import { grpcTypeDefs } from "./types.js";

/**
 * The `grpc` namespace: `call`, `stream`, `reflect` and the `grpc.MethodInfo`
 * type.
 *
 * Requires the `net` capability, so a host without it refuses the plugin at load
 * time rather than failing mid-flow. No matchers: there is no typed subject to
 * write one against.
 */
export const grpcPlugin: PluginDefinition = definePlugin({
  name: "venn/grpc",
  version: "0.0.0",
  namespace: "grpc",
  requires: ["net"],
  actions: grpcActions,
  typeDefs: grpcTypeDefs,
});
