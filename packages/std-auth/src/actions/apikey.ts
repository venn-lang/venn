import { type ActionDefinition, arg, defineAction, z } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";

const params = z.object({ header: z.string().optional() }).optional();

/**
 * `auth.apikey(key, { header })`: a one-entry header object carrying an API key.
 *
 * The header name defaults to `X-API-Key`. Pure, no network.
 */
export const apikey: ActionDefinition = defineAction({
  name: "apikey",
  doc: "Build a header object carrying an API key.",
  params,
  args: [arg("key", t.string, "The API key itself.")],
  result: t.ref("auth.Headers"),
  run: (_ctx, input) => {
    const header = input.params?.header ?? "X-API-Key";
    return { [header]: String(input.args[0] ?? "") };
  },
});
