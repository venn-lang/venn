import { VennError } from "@venn-lang/contracts";
import { PLUGIN_CODES } from "@venn-lang/sdk";
import { fromBase64Url, fromBytes } from "../bytes/index.js";
import type { DecodedJwt } from "./jwt.types.js";

/**
 * Split a token and decode its header and payload, without verifying anything.
 *
 * Reading a token's claims and trusting them are separate acts. This is the
 * first; `crypto.jwt.verify` is the second.
 *
 * @param token A compact JWS, `header.payload.signature`.
 * @returns The decoded sections plus the `signingInput` a signature covers.
 * @throws VennError `VN7003` when the token has fewer than two sections, or when
 * a section is not base64url-encoded JSON.
 */
export function decodeJwt(token: string): DecodedJwt {
  const parts = token.split(".");
  if (parts.length < 2) throw malformed("expected header.payload.signature");
  return {
    header: section(parts[0], "header"),
    payload: section(parts[1], "payload"),
    signature: parts[2] ?? "",
    signingInput: `${parts[0]}.${parts[1]}`,
  };
}

function section(part: string | undefined, what: string): Record<string, unknown> {
  try {
    return JSON.parse(fromBytes(fromBase64Url(part ?? "")));
  } catch {
    throw malformed(`its ${what} is not base64url-encoded JSON`);
  }
}

function malformed(detail: string): VennError {
  return new VennError({ code: PLUGIN_CODES.VN7003_UNREADABLE, message: `Not a JWT — ${detail}.` });
}
