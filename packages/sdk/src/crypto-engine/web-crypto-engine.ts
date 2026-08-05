import { VennError } from "@venn-lang/contracts";
import { toBytes, toHex } from "../bytes/index.js";
import { PLUGIN_CODES } from "../codes.js";
import type { CryptoEngine, DeriveArgs, HashAlgorithm, Signable } from "./crypto-engine.types.js";

/** The only place a digest is spelled the way WebCrypto spells it. */
const NAMES: Record<HashAlgorithm, string> = {
  sha1: "SHA-1",
  sha256: "SHA-256",
  sha384: "SHA-384",
  sha512: "SHA-512",
};

/**
 * The real engine, backed by the platform's global WebCrypto.
 *
 * WebCrypto exists in Node 24 and in browsers alike, so nothing here imports
 * `node:crypto` and the package stays platform-neutral.
 *
 * @returns An engine every `crypto` and `auth` verb can be run against.
 */
export function createWebCryptoEngine(): CryptoEngine {
  return {
    digest: ({ algorithm, data }) =>
      hex("digest", crypto.subtle.digest(NAMES[algorithm], toBytes(data))),
    hmac: ({ algorithm, key, data }) => hex("hmac", sign(algorithm, key, data)),
    derive: (args) => hex("password derivation", deriveBits(args)),
    randomBytes: (size) => randomHex(size),
  };
}

/** Whatever WebCrypto produced, as hex, with any refusal given a code first. */
async function hex(what: string, work: Promise<ArrayBuffer>): Promise<string> {
  try {
    return toHex(new Uint8Array(await work));
  } catch (cause) {
    throw refused(what, cause);
  }
}

function randomHex(size: number): string {
  try {
    return toHex(crypto.getRandomValues(new Uint8Array(size)));
  } catch (cause) {
    throw refused("draw of random bytes", cause);
  }
}

/**
 * A `DOMException` given a `VNxxxx` code and the language's voice.
 *
 * WebCrypto refuses an empty HMAC key, a zero iteration count and more than
 * 65536 random bytes by throwing a `DOMException`. Its `code` is the number `0`,
 * never a `VNxxxx`, so `problemOf` could not recognise it: the failure reached
 * the reporter uncatalogued, under the note `It came with the code "0", which is
 * not one of ours`. Each of those is an argument the primitive refuses, which is
 * what `VN7005` is for, and the runtime puts the call's own span on it.
 */
function refused(what: string, cause: unknown): VennError {
  const detail = cause instanceof Error ? `${cause.name}, ${cause.message}` : String(cause);
  return new VennError({
    code: PLUGIN_CODES.VN7005_BAD_ARGUMENT,
    message: `WebCrypto refused this ${what}: ${detail}.`,
    detail: { what },
  });
}

async function sign(algorithm: HashAlgorithm, key: string, data: Signable): Promise<ArrayBuffer> {
  const spec = { name: "HMAC", hash: NAMES[algorithm] };
  const material = await crypto.subtle.importKey("raw", toBytes(key), spec, false, ["sign"]);
  return crypto.subtle.sign("HMAC", material, typeof data === "string" ? toBytes(data) : data);
}

async function deriveBits(args: DeriveArgs): Promise<ArrayBuffer> {
  const material = await crypto.subtle.importKey("raw", toBytes(args.password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const params = {
    name: "PBKDF2",
    salt: toBytes(args.salt),
    iterations: args.iterations,
    hash: NAMES[args.algorithm],
  };
  return crypto.subtle.deriveBits(params, material, 256);
}
