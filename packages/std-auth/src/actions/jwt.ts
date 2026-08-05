import { type ActionDefinition, defineAction, z } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { signJwt } from "../crypto/index.js";

const params = z.object({
  header: z.record(z.string(), z.unknown()).optional(),
  payload: z.unknown(),
  secret: z.string(),
});

/**
 * `auth.jwt({ header, payload, secret })`: a compact HMAC-signed JWT.
 *
 * `header.alg` chooses the digest, HS256 by default. It signs with what it says.
 */
export const jwt: ActionDefinition = defineAction({
  name: "jwt",
  doc: "Sign a JWT with the algorithm its header names, HS256 by default.",
  params,
  // Header, payload and secret are all options, so nothing goes positionally.
  result: t.string,
  run: (ctx, input) =>
    signJwt({
      ctx,
      header: input.params.header,
      payload: input.params.payload,
      secret: input.params.secret,
    }),
});
