import { type ActionDefinition, arg, defineAction, z } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { hmacHex } from "../crypto/index.js";

const params = z.object({ algo: z.string().optional() }).optional();

/** `auth.hmac(secret, payload, { algo })`: a lowercase hex HMAC. Defaults to SHA-256. */
export const hmac: ActionDefinition = defineAction({
  name: "hmac",
  doc: "Compute a hex HMAC over a payload using a secret.",
  params,
  // Secret first, which is the order `run` reads and the order the README and
  // the doc string always described. The declaration said the opposite, so
  // hover, completion and the node graph told every caller to key the signature
  // with the payload, and a signature keyed by the payload never verifies.
  args: [arg("secret", t.string, "The shared secret."), arg("payload", t.string, "What to sign.")],
  result: t.string,
  run: (_ctx, input) =>
    hmacHex({
      secret: String(input.args[0] ?? ""),
      payload: String(input.args[1] ?? ""),
      algo: input.params?.algo,
    }),
});
