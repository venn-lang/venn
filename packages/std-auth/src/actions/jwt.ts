import { type ActionDefinition, defineAction, z } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { signJwt } from "../crypto/index.js";

const params = z.object({
  header: z.record(z.string(), z.unknown()).optional(),
  payload: z.unknown(),
  secret: z.string(),
});

/** `auth.jwt({ header, payload, secret })`: a compact HS256-signed JWT. */
export const jwt: ActionDefinition = defineAction({
  name: "jwt",
  doc: "Sign an HS256 JWT.",
  params,
  // Header, payload and secret are all options, so nothing goes positionally.
  result: t.string,
  run: (_ctx, input) =>
    signJwt({
      header: input.params.header,
      payload: input.params.payload,
      secret: input.params.secret,
    }),
});
