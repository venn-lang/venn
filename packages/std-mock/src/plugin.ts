import { definePlugin, type PluginDefinition } from "@venn/sdk";
import { mockActions } from "./actions/index.js";
import { mockTypeDefs } from "./types.js";

/**
 * The `mock` plugin: in-process mocking, feature flags and a virtual clock.
 *
 * Everything it does happens in memory, so it needs no host capability and
 * opens no socket. It publishes `mock.Mock`, `mock.Interceptor` and
 * `mock.Response` so a flow can name what its verbs hand back.
 */
export const mockPlugin: PluginDefinition = definePlugin({
  name: "@venn/mock",
  version: "0.0.0",
  namespace: "mock",
  actions: mockActions,
  typeDefs: mockTypeDefs,
});
