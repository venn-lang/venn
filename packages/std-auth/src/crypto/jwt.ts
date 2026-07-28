import { encodeUtf8, toBase64Url } from "./bytes.js";
import { hmacRaw } from "./hmac.js";

/**
 * Sign a compact HS256 JWT.
 *
 * @param args.header Merged over `{ alg: "HS256", typ: "JWT" }`, so a caller can
 * add claims like `kid` but overriding `alg` does not change how it is signed.
 */
export async function signJwt(args: {
  header?: Record<string, unknown>;
  payload: unknown;
  secret: string;
}): Promise<string> {
  const header = { alg: "HS256", typ: "JWT", ...(args.header ?? {}) };
  const signingInput = `${encodeSegment(header)}.${encodeSegment(args.payload)}`;
  const signature = await hmacRaw({
    secret: args.secret,
    message: encodeUtf8(signingInput),
    algo: "sha256",
  });
  return `${signingInput}.${toBase64Url(signature)}`;
}

function encodeSegment(value: unknown): string {
  return toBase64Url(encodeUtf8(JSON.stringify(value)));
}
