import { type ZodType, z } from "@venn/sdk";

/** Runtime schema for the nominal `Token` type, the value `auth.oauth2` yields. */
export const Token: ZodType = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
});
