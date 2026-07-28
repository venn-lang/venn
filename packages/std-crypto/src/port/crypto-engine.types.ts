/** The digests every engine supports. */
export type HashAlgorithm = "sha1" | "sha256" | "sha384" | "sha512";

/** Arguments for {@link CryptoEngine.derive}: a password plus its PBKDF2 cost parameters. */
export interface DeriveArgs {
  password: string;
  salt: string;
  iterations: number;
  algorithm: HashAlgorithm;
}

/**
 * The primitives every `crypto` verb is built from.
 *
 * Each method answers in lowercase hex. That single shape is what the actions
 * convert from, so an engine that returned bytes would break every caller.
 */
export interface CryptoEngine {
  digest(args: { algorithm: HashAlgorithm; data: string }): Promise<string>;
  hmac(args: { algorithm: HashAlgorithm; key: string; data: string }): Promise<string>;
  derive(args: DeriveArgs): Promise<string>;
  randomBytes(size: number): string;
}
