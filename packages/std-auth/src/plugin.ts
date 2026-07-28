import { definePlugin, type PluginDefinition } from "@venn/sdk";
import { authActions } from "./actions/index.js";
import { authTypeDefs, Token } from "./types/index.js";

/**
 * The `auth` plugin: header builders, signing helpers and an OAuth2 exchange.
 *
 * Every verb but `auth.oauth2` is pure. That one reaches out through
 * `AuthClientPort`, which is why the whole plugin declares the `net` capability
 * and is refused at load time on a host that cannot offer it.
 */
export const authPlugin: PluginDefinition = definePlugin({
  name: "@venn/auth",
  version: "0.0.0",
  namespace: "auth",
  requires: ["net"],
  actions: authActions,
  types: { Token },
  typeDefs: authTypeDefs,
});

export { authPlugin as default };
