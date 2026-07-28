import { type TypeSpec, t } from "@venn/types";

/**
 * The named types `@venn/auth` publishes to scripts, keyed by their bare name.
 *
 * `Token` restates `OAuthToken` in `port/auth-client.types.ts` and, field for
 * field, the Zod `Token` next door. Each serves a different reader: Zod checks a
 * value that arrived, this types a call being written. Change all three together.
 */
export const authTypeDefs: Readonly<Record<string, TypeSpec>> = {
  /**
   * What the header builders hand back, ready to go into a request's `headers`.
   *
   * A map rather than a record: `auth.apikey` names its own header, so the key
   * is only known at the call. The values are always strings.
   */
  Headers: t.map(t.string),
  /** An OAuth2 token, as the token endpoint answered with it. */
  Token: t.record({
    access_token: t.string,
    token_type: t.string,
    expires_in: t.number,
  }),
};
