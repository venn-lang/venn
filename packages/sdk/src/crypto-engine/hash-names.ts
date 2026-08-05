import { VennError } from "@venn-lang/contracts";
import { PLUGIN_CODES } from "../codes.js";
import type { HashAlgorithm, JwsAlgorithm } from "./crypto-engine.types.js";

/**
 * Every digest the language knows, in one list.
 *
 * There were three of these: the union here, a `HS256`/`HS384`/`HS512` table in
 * the JWT verbs and a fourth spelling in `@venn-lang/auth`, which meant
 * `auth.hmac` and `crypto.hmac` could disagree about whether `sha384` is a hash.
 * A schema that wants the four names reads them from here rather than repeating
 * them, so adding one is one edit.
 */
export const HASH_ALGORITHMS = ["sha1", "sha256", "sha384", "sha512"] as const;

/**
 * Which digest a piece of writing names, however the caller spelled it.
 *
 * Case and dashes are ignored, so `SHA-256`, `sha256` and `Sha-256` are one
 * answer. A name nothing here answers to is refused rather than quietly signed
 * with the default: `{ algo: "sha51" }` used to produce a signature the far end
 * rejects, with nothing anywhere saying why.
 *
 * @param written What the script wrote, or nothing for the default `sha256`.
 * @returns The digest it names.
 * @throws VennError `VN7005` when it names no digest.
 */
export function hashAlgorithm(written?: string): HashAlgorithm {
  const asked = (written ?? "sha256").toLowerCase().replace(/-/g, "");
  const found = HASH_ALGORITHMS.find((one) => one === asked);
  if (found) return found;
  throw new VennError({
    code: PLUGIN_CODES.VN7005_BAD_ARGUMENT,
    message: `No hash is called "${written}". Accepted: ${HASH_ALGORITHMS.join(", ")}.`,
  });
}

/** The JWS `alg` values these primitives can sign and check (RFC 7518 §3.1, HMAC only). */
export const JWS_ALGORITHMS = ["HS256", "HS384", "HS512"] as const;

/**
 * Which digest each of those names, and only those, is signed with.
 *
 * For a caller that already holds one of the three. A caller reading an `alg`
 * out of a header someone else wrote holds a string, and asks {@link jwsHash}.
 */
export const JWS_HASH: Readonly<Record<JwsAlgorithm, HashAlgorithm>> = {
  HS256: "sha256",
  HS384: "sha384",
  HS512: "sha512",
};

/**
 * Which digest a token's `alg` header names.
 *
 * One answer for the signer and the verifier, which is the whole point. A signer
 * that put `HS512` in the header and then signed with SHA-256 minted a token
 * claiming something it was not, and the verifier believed the claim, hashed with
 * SHA-512 and compared two different digests over identical input: `false`, for
 * a token nothing had tampered with.
 *
 * @param alg The `alg` value read from a header, or written into one.
 * @returns The digest to sign and check with, or nothing when no HMAC digest
 * answers to that name, which is every asymmetric algorithm and every typo.
 */
export function jwsHash(alg: string): HashAlgorithm | undefined {
  const found = JWS_ALGORITHMS.find((one) => one === alg);
  return found && JWS_HASH[found];
}
