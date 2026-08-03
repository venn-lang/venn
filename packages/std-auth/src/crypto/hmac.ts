import { VennError } from "@venn-lang/contracts";
import { PLUGIN_CODES } from "@venn-lang/sdk";
import { encodeUtf8, toHex } from "./bytes.js";

const ALGOS: Record<string, string> = {
  sha1: "SHA-1",
  sha256: "SHA-256",
  sha384: "SHA-384",
  sha512: "SHA-512",
};

/**
 * Map whatever the script wrote (`sha256`, `SHA-256`) to a WebCrypto hash name.
 *
 * A name nothing here answers to is refused. It used to sign with SHA-256
 * instead, so `{ algo: "sha51" }` produced a signature the far end rejects and
 * nothing said why, while `crypto.hash` in the same stdlib refused the same
 * typo before the run started. One primitive, one policy.
 *
 * @param algo What the script wrote, or nothing for the default.
 * @returns The WebCrypto hash name.
 * @throws VennError `VN7005` when the label names no hash.
 */
export function normalizeHash(algo?: string): string {
  const key = (algo ?? "sha256").toLowerCase().replace(/-/g, "");
  const found = ALGOS[key];
  if (found) return found;
  throw new VennError({
    code: PLUGIN_CODES.VN7005_BAD_ARGUMENT,
    message: `No hash is called "${algo}". Accepted: ${Object.keys(ALGOS).join(", ")}.`,
  });
}

/** Raw HMAC bytes over `message`, keyed by `secret`, using the global Web Crypto. */
export async function hmacRaw(args: {
  secret: string;
  message: Uint8Array<ArrayBuffer>;
  algo?: string;
}): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encodeUtf8(args.secret),
    { name: "HMAC", hash: normalizeHash(args.algo) },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, args.message);
  return new Uint8Array(signature);
}

/** Lowercase hex HMAC over a string `payload`, keyed by `secret` (default SHA-256). */
export async function hmacHex(args: {
  secret: string;
  payload: string;
  algo?: string;
}): Promise<string> {
  return toHex(
    await hmacRaw({ secret: args.secret, message: encodeUtf8(args.payload), algo: args.algo }),
  );
}
