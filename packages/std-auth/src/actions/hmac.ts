import { type ActionDefinition, arg, defineAction, z } from "@venn/sdk";
import { t } from "@venn/types";
import { hmacHex } from "../crypto/index.js";

const params = z.object({ algo: z.string().optional() }).optional();

/** `auth.hmac(secret, payload, { algo })`: a lowercase hex HMAC. Defaults to SHA-256. */
export const hmac: ActionDefinition = defineAction({
  name: "hmac",
  doc: "Compute a hex HMAC over a payload using a secret.",
  params,
  args: [arg("payload", t.string, "What to sign."), arg("secret", t.string, "The shared secret.")],
  result: t.string,
  run: (_ctx, input) =>
    hmacHex({
      secret: String(input.args[0] ?? ""),
      payload: String(input.args[1] ?? ""),
      algo: input.params?.algo,
    }),
});
