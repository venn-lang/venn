import type { Port } from "@venn-lang/contracts";
import type { CryptoEngine } from "./crypto-engine.types.js";

/**
 * The port every `crypto` verb reaches its primitives through.
 *
 * Bound by the host to `createWebCryptoEngine` or `createFakeCryptoEngine`.
 * Requires no capability, because WebCrypto is present on every target.
 */
export const CryptoEnginePort: Port<CryptoEngine> = {
  id: "venn.port.crypto-engine",
  version: 1,
  requires: [],
  methods: ["digest", "hmac", "derive", "randomBytes"],
};
