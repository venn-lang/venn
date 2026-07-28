// Pure byte encoders shared by the HMAC, TOTP and JWT builders. No I/O and no
// ports, only deterministic transforms over Web-standard primitives.

/** UTF-8 encode a string. The copy is ArrayBuffer-backed, the only shape WebCrypto accepts. */
export function encodeUtf8(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(new TextEncoder().encode(text));
}

/** Lowercase hex of a byte array. */
export function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

/** URL-safe, unpadded base64 (base64url) of a byte array. */
export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
