import type { Bytes } from "../bytes/index.js";
import type { HASH_ALGORITHMS, JWS_ALGORITHMS } from "./hash-names.js";

/** The digests every engine supports. */
export type HashAlgorithm = (typeof HASH_ALGORITHMS)[number];

/** The JWS `alg` header values these primitives sign and verify. */
export type JwsAlgorithm = (typeof JWS_ALGORITHMS)[number];

/**
 * What an HMAC covers.
 *
 * Bytes as well as text, because a HOTP counter is eight raw bytes (RFC 4226 §5)
 * and UTF-8 has no way to carry the byte `0x80` as a character. Handing those
 * bytes over as a string re-encodes them into something longer and the code that
 * comes out matches no authenticator.
 */
export type Signable = string | Bytes;

/** Arguments for {@link CryptoEngine.derive}: a password plus its PBKDF2 cost parameters. */
export interface DeriveArgs {
  password: string;
  salt: string;
  iterations: number;
  algorithm: HashAlgorithm;
}

/**
 * The primitives every `crypto` and `auth` verb is built from.
 *
 * Each method answers in lowercase hex. That single shape is what the actions
 * convert from, so an engine that returned bytes would break every caller.
 */
export interface CryptoEngine {
  digest(args: { algorithm: HashAlgorithm; data: string }): Promise<string>;
  hmac(args: { algorithm: HashAlgorithm; key: string; data: Signable }): Promise<string>;
  derive(args: DeriveArgs): Promise<string>;
  randomBytes(size: number): string;
}
