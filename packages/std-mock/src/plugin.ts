import { definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import { mockActions } from "./actions/index.js";
import { mockTypeDefs } from "./types.js";

/**
 * The `mock` plugin: in-process mocking, feature flags and a virtual clock.
 *
 * Everything it does happens in memory, so it needs no host capability and
 * opens no socket. It publishes `mock.Mock`, `mock.Interceptor` and
 * `mock.Response` so a flow can name what its verbs hand back.
 *
 * The mocks, the flags and the frozen clock belong to the flow that set them:
 * a flow that never froze anything used to read back the hour another flow had
 * frozen, which is a lie a reader has no way to spot.
 */
export const mockPlugin: PluginDefinition = definePlugin({
  name: "venn/mock",
  namespace: "mock",
  actions: mockActions,
  typeDefs: mockTypeDefs,
});
