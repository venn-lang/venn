import { VennError } from "@venn-lang/contracts";
import { PLUGIN_CODES } from "../codes.js";
import type { Bytes } from "./bytes.types.js";

/** The base64 alphabet of RFC 4648 §4, indexed by the six-bit value it spells. */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Standard base64, padded (RFC 4648 §4).
 *
 * Written out rather than handed to `btoa`, which cost this repository two bugs
 * at once. `btoa` reads a string one code unit at a time and refuses anything
 * above U+00FF, so every caller first had to flatten bytes into a latin-1
 * string, and both ways of doing that are broken: `String.fromCharCode(...bytes)`
 * spreads one argument per byte onto the stack, so 200 KB of text raised a
 * `RangeError` about call stack depth that the reporter reads as runaway
 * recursion, and a per-byte loop is stack-safe but forces the caller to have got
 * the UTF-8 step right first. `btoa` is also absent on some targets this has to
 * run on. Alphabet arithmetic has none of those problems: no intermediate
 * string, no argument list, no platform to be missing, and no throw at all.
 *
 * @param bytes What to encode. Base64 is encoding, not secrecy.
 * @returns Padded base64. Empty input gives an empty string.
 */
export function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (let at = 0; at < bytes.length; at += 3) out += quad(bytes, at);
  return out;
}

/** The four characters the three bytes at `at` spell, padded when fewer remain. */
function quad(bytes: Uint8Array, at: number): string {
  const held = ((bytes[at] ?? 0) << 16) | ((bytes[at + 1] ?? 0) << 8) | (bytes[at + 2] ?? 0);
  const left = bytes.length - at;
  let out = "";
  for (let piece = 0; piece < 4; piece += 1) {
    out += piece <= left ? ALPHABET[(held >> (18 - piece * 6)) & 63] : "=";
  }
  return out;
}

/**
 * Read standard base64 back into bytes.
 *
 * ASCII whitespace is ignored, as the WHATWG forgiving-base64 rules ignore it,
 * so text wrapped at 64 columns still reads. Padding is optional.
 *
 * @param text Base64, padded or not.
 * @returns The bytes it spells.
 * @throws VennError `VN7003` when a character is not a base64 digit, or when the
 * count of digits spells no whole byte. `atob` raised a `DOMException` here, and
 * a `DOMException` carries no `VNxxxx` code, so an unreadable token reached the
 * reporter as an unrecognised throw with no line under it.
 */
export function fromBase64(text: string): Bytes {
  const digits = digitsOf(text);
  const bytes = new Uint8Array((digits.length * 3) >> 2) as Bytes;
  for (let at = 0; at < digits.length; at += 4) triple({ digits, at, into: bytes });
  return bytes;
}

/** The up to three bytes one group of four digits spells, written where they belong. */
function triple(args: { digits: string; at: number; into: Bytes }): void {
  const { digits, at, into } = args;
  const taken = Math.min(4, digits.length - at);
  let held = 0;
  for (let piece = 0; piece < 4; piece += 1) {
    held = (held << 6) | (piece < taken ? digitOf(digits.charCodeAt(at + piece)) : 0);
  }
  const start = (at >> 2) * 3;
  for (let byte = 0; byte < taken - 1; byte += 1) {
    into[start + byte] = (held >> (16 - byte * 8)) & 0xff;
  }
}

/** Whitespace and padding dropped, and what is left checked for being decodable. */
function digitsOf(text: string): string {
  const digits = text.replace(/[\t\n\f\r ]/g, "").replace(/=+$/, "");
  // Four digits carry three bytes, three carry two and two carry one. One digit
  // carries six bits, which is part of a byte and no byte.
  if (digits.length % 4 === 1) throw unreadable(`${digits.length} digits spell no whole byte`);
  return digits;
}

/**
 * The six-bit value of each digit, by character code, and `-1` for the rest.
 *
 * A table rather than `ALPHABET.indexOf`, which answers `0` for the empty string
 * and so turns a read past the end into the byte `A` instead of a refusal.
 */
const VALUES = new Int8Array(128).fill(-1);
for (let value = 0; value < ALPHABET.length; value += 1) {
  VALUES[ALPHABET.charCodeAt(value)] = value;
}

function digitOf(code: number): number {
  const value = code < 128 ? (VALUES[code] ?? -1) : -1;
  if (value < 0) throw unreadable(`"${String.fromCharCode(code)}" is not a base64 digit`);
  return value;
}

function unreadable(detail: string): VennError {
  return new VennError({
    code: PLUGIN_CODES.VN7003_UNREADABLE,
    message: `Not base64: ${detail}.`,
  });
}

/**
 * Base64url, the flavour JWT uses (RFC 4648 §5): `+/` become `-_`, padding goes.
 *
 * @param bytes What to encode.
 * @returns Unpadded base64url, safe in a URL and in a token segment.
 */
export function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Read base64url back into bytes.
 *
 * No padding is restored first, because {@link fromBase64} does not need any.
 *
 * @param text Base64url, padded or not.
 * @returns The bytes it spells.
 * @throws VennError `VN7003` when the text is not base64url.
 */
export function fromBase64Url(text: string): Bytes {
  return fromBase64(text.replace(/-/g, "+").replace(/_/g, "/"));
}
