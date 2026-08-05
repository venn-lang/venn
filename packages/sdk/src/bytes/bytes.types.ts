/**
 * Bytes backed by a plain `ArrayBuffer`, the only shape WebCrypto accepts.
 *
 * A `Uint8Array` may sit on a `SharedArrayBuffer`, which `crypto.subtle` refuses,
 * so the buffer is named in the type rather than discovered at the call.
 */
export type Bytes = Uint8Array<ArrayBuffer>;
