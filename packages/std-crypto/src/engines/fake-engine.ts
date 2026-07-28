import type { CryptoEngine } from "../port/index.js";

/**
 * A deterministic stand-in for tests: same input, same output, no platform crypto.
 *
 * Not secure and not meant to be. It exists so assertions over a digest, an HMAC
 * or a random token stay reproducible from run to run.
 */
export function createFakeCryptoEngine(): CryptoEngine {
  let counter = 0;
  return {
    digest: ({ algorithm, data }) => Promise.resolve(stable(`${algorithm}|${data}`)),
    hmac: ({ algorithm, key, data }) => Promise.resolve(stable(`${algorithm}|${key}|${data}`)),
    derive: (args) =>
      Promise.resolve(stable(`${args.algorithm}|${args.password}|${args.salt}|${args.iterations}`)),
    randomBytes: (size) => {
      counter += 1;
      return sized(stable(`bytes|${counter}`), size);
    },
  };
}

// FNV-1a, run over the seed with a changing suffix until 64 hex digits are filled.
function stable(seed: string): string {
  let out = "";
  for (let round = 0; out.length < 64; round++) {
    out += fnv1a(`${seed}|${round}`).toString(16).padStart(8, "0");
  }
  return out.slice(0, 64);
}

function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function sized(hex: string, size: number): string {
  return hex.repeat(Math.ceil((size * 2) / hex.length)).slice(0, size * 2);
}
