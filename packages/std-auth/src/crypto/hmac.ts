import {
  type ActionContext,
  CryptoEnginePort,
  type HashAlgorithm,
  type Signable,
} from "@venn-lang/sdk";

/**
 * A lowercase hex HMAC, through whichever engine the host bound.
 *
 * The one place `auth` reaches a digest. It used to call the global
 * `crypto.subtle` here, which meant a host that bound `createFakeCryptoEngine`
 * changed what `crypto.hmac` answered and left `auth.hmac`, `auth.totp` and
 * `auth.jwt` on real WebCrypto: half the run reproducible, half not.
 *
 * @param args.ctx The action context, which is what holds the bound engine.
 * @param args.secret The key.
 * @param args.payload What to sign. Bytes stay bytes, for a TOTP counter.
 * @param args.algorithm Which digest, already resolved from whatever was written.
 * @returns The MAC in lowercase hex.
 */
export function hmacHex(args: {
  ctx: ActionContext;
  secret: string;
  payload: Signable;
  algorithm: HashAlgorithm;
}): Promise<string> {
  return args.ctx.port(CryptoEnginePort).hmac({
    algorithm: args.algorithm,
    key: args.secret,
    data: args.payload,
  });
}
