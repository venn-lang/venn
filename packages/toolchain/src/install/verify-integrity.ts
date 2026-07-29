import type { Release } from "../registry/index.js";

/**
 * Whether bytes are the ones the registry published.
 *
 * The registry states an integrity hash beside every tarball, and checking it
 * is what makes a download from anywhere safe to unpack: a mirror, a proxy or
 * anything else in between can hand over different bytes, and only the hash
 * says so.
 *
 * Uses Web Crypto, so this stays runnable wherever the rest of the package is.
 *
 * @param bytes What arrived.
 * @param integrity The registry's claim, as `sha512-<base64>`. An algorithm
 * that is not understood fails rather than being waved through.
 * @returns Whether they match.
 */
export async function matchesIntegrity(args: {
  bytes: Uint8Array;
  integrity: string;
}): Promise<boolean> {
  const stated = parse(args.integrity);
  if (!stated) return false;
  const digest = await crypto.subtle.digest(stated.algorithm, args.bytes as BufferSource);
  return base64Of(new Uint8Array(digest)) === stated.digest;
}

/**
 * Checks a download and says what is wrong when it does not match.
 *
 * Separate from {@link matchesIntegrity} because the answer is not a boolean to
 * anyone reading it: bytes that do not match the hash are either a corrupted
 * download or something in between handing over a different file, and both need
 * the version named to be acted on.
 *
 * @throws Error naming the version when the bytes are not the published ones.
 */
export async function verifyIntegrity(args: {
  bytes: Uint8Array;
  release: Release;
}): Promise<void> {
  if (await matchesIntegrity({ bytes: args.bytes, integrity: args.release.integrity })) return;
  throw new Error(
    `the download for ${args.release.version} does not match the hash the registry published`,
  );
}

/** `sha512-<base64>`, which is what npm publishes. */
function parse(integrity: string): { algorithm: string; digest: string } | undefined {
  const at = integrity.indexOf("-");
  if (at <= 0) return undefined;
  const named = integrity.slice(0, at).toLowerCase();
  const algorithm = { sha256: "SHA-256", sha384: "SHA-384", sha512: "SHA-512" }[named];
  if (!algorithm) return undefined;
  return { algorithm, digest: integrity.slice(at + 1) };
}

/** No `btoa` here: it is not everywhere this has to run, and this is 8 lines. */
function base64Of(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let at = 0; at < bytes.length; at += 3) {
    const chunk = ((bytes[at] ?? 0) << 16) | ((bytes[at + 1] ?? 0) << 8) | (bytes[at + 2] ?? 0);
    const taken = bytes.length - at;
    for (let piece = 0; piece < 4; piece += 1) {
      out += piece <= taken ? alphabet[(chunk >> (18 - piece * 6)) & 63] : "=";
    }
  }
  return out;
}
