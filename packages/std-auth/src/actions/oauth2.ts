import { type ActionDefinition, arg, defineAction, z } from "@venn/sdk";
import { t } from "@venn/types";
import { AuthClientPort } from "../port/index.js";

const params = z
  .object({
    grant: z.string().optional(),
    tokenUrl: z.string().optional(),
    scope: z.string().optional(),
    refresh: z.string().optional(),
  })
  .optional();

/**
 * `auth.oauth2(principal, { grant, tokenUrl, scope, refresh })`: an `auth.Token`.
 *
 * The only verb here that leaves the process, and it does so through
 * `AuthClientPort` rather than calling the endpoint itself.
 */
export const oauth2: ActionDefinition = defineAction({
  name: "oauth2",
  doc: "Obtain an OAuth2 token for a principal via the AuthClient port.",
  params,
  args: [arg("principal", t.string, "Who the token is for.")],
  result: t.ref("auth.Token"),
  run: (ctx, input) =>
    ctx.port(AuthClientPort).token({
      principal: String(input.args[0] ?? ""),
      grant: input.params?.grant,
      tokenUrl: input.params?.tokenUrl,
      scope: input.params?.scope,
      refresh: input.params?.refresh,
    }),
});
