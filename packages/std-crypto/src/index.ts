// @venn-lang/crypto: hashes, HMACs, base64, PBKDF2 password hashing and JSON Web
// Tokens, all reached through the CryptoEngine port.
//
// The byte encoders and the engine port itself now live in `@venn-lang/sdk`,
// because `@venn-lang/auth` needs both and a plugin may not depend on another
// plugin. They are passed on from here unchanged: a plugin outside this
// repository that imports `toBase64` or `CryptoEnginePort` from `@venn-lang/crypto`
// keeps working, and there is still only one definition of each.

export type { CryptoEngine, DeriveArgs, HashAlgorithm } from "@venn-lang/sdk";
export {
  CryptoEnginePort,
  createFakeCryptoEngine,
  createWebCryptoEngine,
  equals,
  fromBase64,
  fromBase64Url,
  fromBytes,
  fromHex,
  toBase64,
  toBase64Url,
  toBytes,
  toHex,
} from "@venn-lang/sdk";
export type { DecodedJwt } from "./jwt/index.js";
export { decodeJwt } from "./jwt/index.js";
export { cryptoPlugin } from "./plugin.js";
