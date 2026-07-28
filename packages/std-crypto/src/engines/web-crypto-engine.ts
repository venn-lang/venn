import { toBytes, toHex } from "../bytes/index.js";
import type { CryptoEngine, DeriveArgs, HashAlgorithm } from "../port/index.js";

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
 */
export function createWebCryptoEngine(): CryptoEngine {
  return {
    digest: async ({ algorithm, data }) =>
      toHex(new Uint8Array(await crypto.subtle.digest(NAMES[algorithm], toBytes(data)))),
    hmac: async ({ algorithm, key, data }) =>
      toHex(new Uint8Array(await sign(algorithm, key, data))),
    derive: async (args) => toHex(new Uint8Array(await deriveBits(args))),
    randomBytes: (size) => toHex(crypto.getRandomValues(new Uint8Array(size))),
  };
}

async function sign(algorithm: HashAlgorithm, key: string, data: string): Promise<ArrayBuffer> {
  const spec = { name: "HMAC", hash: NAMES[algorithm] };
  const material = await crypto.subtle.importKey("raw", toBytes(key), spec, false, ["sign"]);
  return crypto.subtle.sign("HMAC", material, toBytes(data));
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
