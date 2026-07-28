// Conversions between the shapes crypto work needs: text, bytes, hex, base64.
// All pure, all platform-neutral.

/** Bytes backed by a plain `ArrayBuffer`, the only shape WebCrypto accepts. */
export type Bytes = Uint8Array<ArrayBuffer>;

/** UTF-8 encode a string. */
export function toBytes(text: string): Bytes {
  return new TextEncoder().encode(text) as Bytes;
}

/** UTF-8 decode bytes back to a string. Invalid sequences become the replacement character. */
export function fromBytes(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/** Lowercase hex, two characters per byte. */
export function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Read a hex string back into bytes. A trailing odd character is dropped. */
export function fromHex(hex: string): Bytes {
  const pairs = hex.match(/../g) ?? [];
  return Uint8Array.from(pairs.map((pair) => Number.parseInt(pair, 16))) as Bytes;
}

/** Standard base64, padded. */
export function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Read standard base64 back into bytes.
 *
 * @throws DOMException when the text is not valid base64.
 */
export function fromBase64(text: string): Bytes {
  return Uint8Array.from(atob(text), (char) => char.charCodeAt(0)) as Bytes;
}

/** Base64url, the flavour JWT uses: `+/` become `-_` and padding is dropped. */
export function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Read base64url back into bytes, restoring the padding first.
 *
 * @throws DOMException when the text is not valid base64url.
 */
export function fromBase64Url(text: string): Bytes {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  return fromBase64(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
}

/**
 * Compare two strings in time that does not depend on where they differ.
 *
 * Use this for every signature and digest check: `===` returns early on the
 * first mismatched byte, which leaks the correct prefix to a patient attacker.
 */
export function equals(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index++) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}
