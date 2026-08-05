import type { Bytes } from "./bytes.types.js";

/**
 * Lowercase hex, two characters per byte.
 *
 * @param bytes What to write.
 * @returns Its hex spelling. Empty input gives an empty string.
 */
export function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

/**
 * Read a hex string back into bytes. A trailing odd character is dropped.
 *
 * @param hex Hex, in either case.
 * @returns The bytes it spells.
 */
export function fromHex(hex: string): Bytes {
  const pairs = hex.match(/../g) ?? [];
  return Uint8Array.from(pairs.map((pair) => Number.parseInt(pair, 16))) as Bytes;
}
