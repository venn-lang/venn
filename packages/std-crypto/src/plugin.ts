import { definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import { cryptoActions } from "./actions/index.js";
import { cryptoTypeDefs } from "./types.js";

/**
 * The `crypto` plugin: digests, encodings, password hashing and JSON Web Tokens.
 *
 * Every primitive comes from `CryptoEnginePort`, so a host can swap WebCrypto for
 * the deterministic fake and keep assertions reproducible. No capability is
 * required: WebCrypto is present in Node and in the browser alike.
 */
export const cryptoPlugin: PluginDefinition = definePlugin({
  name: "venn/crypto",
  namespace: "crypto",
  actions: cryptoActions,
  typeDefs: cryptoTypeDefs,
});
