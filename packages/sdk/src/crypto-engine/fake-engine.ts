import { toHex } from "../bytes/index.js";
import type { CryptoEngine, Signable } from "./crypto-engine.types.js";

/**
 * A deterministic stand-in for tests: same input, same output, no platform crypto.
 *
 * Not secure and not meant to be. It exists so assertions over a digest, an HMAC
 * or a random token stay reproducible from run to run.
 *
 * @returns An engine whose answers depend only on what it was asked.
 */
export function createFakeCryptoEngine(): CryptoEngine {
  let counter = 0;
  return {
    digest: ({ algorithm, data }) => Promise.resolve(stable(`${algorithm}|${data}`)),
    hmac: ({ algorithm, key, data }) =>
      Promise.resolve(stable(`${algorithm}|${key}|${written(data)}`)),
    derive: (args) =>
      Promise.resolve(stable(`${args.algorithm}|${args.password}|${args.salt}|${args.iterations}`)),
    randomBytes: (size) => {
      counter += 1;
      return sized(stable(`bytes|${counter}`), size);
    },
  };
}

// Bytes as hex, so signing eight raw bytes never collides with signing the text
// that happens to spell them, which is the whole reason `hmac` accepts both.
function written(data: Signable): string {
  return typeof data === "string" ? `text:${data}` : `bytes:${toHex(data)}`;
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
