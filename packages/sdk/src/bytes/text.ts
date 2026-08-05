import type { Bytes } from "./bytes.types.js";

/**
 * UTF-8 encode a string.
 *
 * This is the step four callers used to skip. `btoa("señor")` throws, and
 * `btoa` over the code units of a string that survived it encodes latin-1, so a
 * credential with an accent in it went onto the wire as bytes the far end reads
 * as different letters. Text becomes bytes here, once, and nothing downstream
 * has to know how a string is spelled in memory.
 *
 * @param text What to encode.
 * @returns Its UTF-8 bytes.
 */
export function toBytes(text: string): Bytes {
  return new TextEncoder().encode(text) as Bytes;
}

/**
 * UTF-8 decode bytes back to a string.
 *
 * @param bytes What to decode. Invalid sequences become the replacement
 * character rather than raising, because a decoder that throws turns a
 * truncated response body into a failure with no content to show.
 * @returns The text those bytes spell.
 */
export function fromBytes(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}
