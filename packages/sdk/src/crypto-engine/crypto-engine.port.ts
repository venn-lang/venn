import type { Port } from "@venn-lang/contracts";
import type { CryptoEngine } from "./crypto-engine.types.js";

/**
 * The port every `crypto` and `auth` verb reaches its primitives through.
 *
 * Bound by the host to `createWebCryptoEngine` or `createFakeCryptoEngine`.
 *
 * It lives in the SDK rather than in `@venn-lang/crypto` because two plugins
 * need it and a plugin may not depend on another plugin. `@venn-lang/auth` used
 * to reach the global `crypto.subtle` directly instead, so binding a fake engine
 * changed what `crypto.hmac` answered and left `auth.hmac` on real WebCrypto.
 *
 * Requires `random`, because `randomBytes` draws. This declared nothing until
 * now, reasoning that WebCrypto is present on every target, and that reasoning
 * answers the wrong question: a capability says what the host is being asked to
 * supply, not whether the code to do it exists anywhere. Randomness is the one
 * thing here a host may legitimately refuse, and while it went undeclared
 * `crypto.randomBytes` and `crypto.uuid` were legal inside a `fn`, which the
 * language calls pure. A digest and an hmac are deterministic and pay for the
 * draw's declaration, because a port binds as a whole.
 *
 * Version 2: `hmac` takes bytes as well as text, so a TOTP counter can be signed
 * as the eight bytes it is.
 */
export const CryptoEnginePort: Port<CryptoEngine> = {
  id: "venn.port.crypto-engine",
  version: 2,
  requires: ["random"],
  methods: ["digest", "hmac", "derive", "randomBytes"],
};
