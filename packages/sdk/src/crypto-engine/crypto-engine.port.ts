import type { Port } from "@venn-lang/contracts";
import type { CryptoEngine } from "./crypto-engine.types.js";

/**
 * The port every `crypto` and `auth` verb reaches its primitives through.
 *
 * Bound by the host to `createWebCryptoEngine` or `createFakeCryptoEngine`.
 * Requires no capability, because WebCrypto is present on every target.
 *
 * It lives in the SDK rather than in `@venn-lang/crypto` because two plugins
 * need it and a plugin may not depend on another plugin. `@venn-lang/auth` used
 * to reach the global `crypto.subtle` directly instead, so binding a fake engine
 * changed what `crypto.hmac` answered and left `auth.hmac` on real WebCrypto.
 *
 * Version 2: `hmac` takes bytes as well as text, so a TOTP counter can be signed
 * as the eight bytes it is.
 */
export const CryptoEnginePort: Port<CryptoEngine> = {
  id: "venn.port.crypto-engine",
  version: 2,
  requires: [],
  methods: ["digest", "hmac", "derive", "randomBytes"],
};
