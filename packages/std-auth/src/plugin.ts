import { definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import { authActions } from "./actions/index.js";
import { authTypeDefs } from "./types/index.js";

/**
 * The `auth` plugin: header builders, signing helpers and an OAuth2 exchange.
 *
 * `auth.oauth2` reaches out through `AuthClientPort`, which is why the plugin
 * declares `net` and is refused at load time on a host that cannot offer it.
 *
 * `random` comes with `CryptoEnginePort`, which `auth.hmac`, `auth.jwt` and
 * `auth.totp` sign through. The port declares it because it also publishes
 * `randomBytes`, and a port binds as a whole, so a plugin that signs pays for
 * the draw it never makes. This plugin used to say "every verb but `auth.oauth2`
 * is pure"; the signing verbs are indeed deterministic, but they are refused in
 * a `fn` along with the rest, because a capability is declared per plugin while
 * purity is a property of each verb.
 */
export const authPlugin: PluginDefinition = definePlugin({
  name: "venn/auth",
  namespace: "auth",
  requires: ["net", "random"],
  actions: authActions,
  typeDefs: authTypeDefs,
});

export { authPlugin as default };
