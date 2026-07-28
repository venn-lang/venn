import { type TypeSpec, t } from "@venn-lang/types";

/**
 * The named types `@venn-lang/crypto` publishes to scripts, keyed by their bare name.
 *
 * One name is enough: every other verb answers with a string or a boolean, which
 * reads better inline than behind a name that adds nothing. Hand-mirrored from
 * `DecodedJwt` in `jwt/jwt.types.ts`, so change the two together.
 */
export const cryptoTypeDefs: Readonly<Record<string, TypeSpec>> = {
  /**
   * A token taken apart. The claims are whatever the issuer put there, so both
   * sections are maps of dynamic rather than a shape nobody can promise.
   */
  Jwt: t.record({
    header: t.map(t.dynamic),
    payload: t.map(t.dynamic),
    signature: t.string,
    signingInput: t.string,
  }),
};
