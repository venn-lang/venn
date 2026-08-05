import { VennError } from "@venn-lang/contracts";
import {
  type ActionContext,
  fromHex,
  jwsHash,
  PLUGIN_CODES,
  toBase64Url,
  toBytes,
} from "@venn-lang/sdk";
import { hmacHex } from "./hmac.js";

/**
 * Sign a compact JWT with the algorithm its own header names.
 *
 * `header` is merged over `{ alg: "HS256", typ: "JWT" }`, so a caller can add
 * `kid` and can also choose the algorithm. Choosing it used to change only what
 * the token claimed: `alg` became `HS512` in the signed bytes while the signature
 * stayed SHA-256, and `crypto.jwt.verify` read the claim, hashed with SHA-512 and
 * answered `false` for a token nothing had touched. A token now is what it says
 * it is.
 *
 * @param args.ctx The action context, which holds the bound engine.
 * @param args.header Extra header fields. `alg` decides the signature.
 * @param args.payload The claims.
 * @param args.secret The shared secret.
 * @returns The compact token, `header.payload.signature`.
 * @throws VennError `VN7005` when `alg` names no HMAC digest, because a token
 * signed under a name the verifier cannot map is a token nothing accepts.
 */
export async function signJwt(args: {
  ctx: ActionContext;
  header?: Record<string, unknown>;
  payload: unknown;
  secret: string;
}): Promise<string> {
  const header = { alg: "HS256", typ: "JWT", ...(args.header ?? {}) };
  const algorithm = jwsHash(String(header.alg));
  if (!algorithm) throw notSignable(String(header.alg));
  const signingInput = `${encodeSegment(header)}.${encodeSegment(args.payload)}`;
  const mac = await hmacHex({ ...args, payload: signingInput, algorithm });
  return `${signingInput}.${toBase64Url(fromHex(mac))}`;
}

function notSignable(alg: string): VennError {
  return new VennError({
    code: PLUGIN_CODES.VN7005_BAD_ARGUMENT,
    message: `No token is signed with "${alg}". Accepted: HS256, HS384, HS512.`,
  });
}

function encodeSegment(value: unknown): string {
  return toBase64Url(toBytes(JSON.stringify(value)));
}
