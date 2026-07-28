/** Arguments for {@link AuthClient.token}: which principal, and how to obtain or refresh it. */
export interface OAuthTokenRequest {
  principal: string;
  grant?: string;
  tokenUrl?: string;
  scope?: string;
  refresh?: string;
}

/** A token as the endpoint answered with it. Snake case, because that is the wire shape. */
export interface OAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * The contract `auth.oauth2` acquires tokens through.
 *
 * Reached via `ctx.port(AuthClientPort)`, never by calling an endpoint directly.
 */
export interface AuthClient {
  token(request: OAuthTokenRequest): Promise<OAuthToken>;
}
