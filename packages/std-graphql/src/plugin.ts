import { definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import { gqlActions } from "./actions/index.js";
import { gqlMatchers } from "./matchers/index.js";
import { gqlTypeDefs } from "./types.js";

/**
 * The `gql` namespace: `query`, `mutate`, `subscribe`, the `noGraphqlErrors`
 * matcher and the `gql.GraphqlResponse` type.
 *
 * Requires the `net` capability, so a host without it refuses the plugin at load
 * time rather than failing mid-flow.
 */
export const gqlPlugin: PluginDefinition = definePlugin({
  name: "venn/graphql",
  namespace: "gql",
  requires: ["net"],
  actions: gqlActions,
  matchers: gqlMatchers,
  typeDefs: gqlTypeDefs,
});
