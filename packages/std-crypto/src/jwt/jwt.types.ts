/** A JWT taken apart, verified or not. */
export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  /** The third section, still base64url. Empty when the token carries none. */
  signature: string;
  /** `header.payload`, exactly the bytes the signature covers. */
  signingInput: string;
}
