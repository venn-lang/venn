import { definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import { cryptoActions } from "./actions/index.js";
import { cryptoTypeDefs } from "./types.js";

/**
 * The `crypto` plugin: digests, encodings, password hashing and JSON Web Tokens.
 *
 * Every primitive comes from `CryptoEnginePort`, so a host can swap WebCrypto for
 * the deterministic fake and keep assertions reproducible.
 *
 * Requires `random`, following the port. This said "no capability is required:
 * WebCrypto is present in Node and in the browser alike", and that sentence is
 * where the defect came from rather than being a stale note beside it. Whether
 * the code exists on the target is not what a capability asks. `crypto.uuid` and
 * `crypto.randomBytes` draw, `crypto.password.hash` draws its salt, and while
 * the plugin and the port both declared nothing all three were legal inside a
 * `fn`, which the language calls pure. A silently non-deterministic pure
 * function is a worse outcome than a refused digest.
 */
export const cryptoPlugin: PluginDefinition = definePlugin({
  name: "venn/crypto",
  namespace: "crypto",
  requires: ["random"],
  actions: cryptoActions,
  typeDefs: cryptoTypeDefs,
});
