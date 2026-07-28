import type { AuthClient, OAuthToken } from "../port/index.js";

/**
 * The in-process `AuthClient`: a canned token derived from the principal, no network.
 *
 * @param args.token Fields to override on every token it hands back.
 */
export function createFakeAuthClient(args: { token?: Partial<OAuthToken> } = {}): AuthClient {
  return {
    token: async (request) => ({
      access_token: `fake-access-token:${request.principal}`,
      token_type: "Bearer",
      expires_in: 3600,
      ...args.token,
    }),
  };
}
