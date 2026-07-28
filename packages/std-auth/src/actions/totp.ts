import { type ActionDefinition, arg, defineAction, z } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { totpCode } from "../crypto/index.js";

const params = z
  .object({
    at: z.number().optional(),
    period: z.number().optional(),
    digits: z.number().optional(),
  })
  .optional();

/**
 * `auth.totp(seed, { at, period, digits })`: an RFC 6238 one-time code.
 *
 * Pin `at` to a fixed instant to get the same code on every run.
 */
export const totp: ActionDefinition = defineAction({
  name: "totp",
  doc: "Compute a TOTP code from a shared seed.",
  params,
  // A code is digits, but it is written and compared as text: leading zeros are
  // part of it, so the result is a string and not a number.
  args: [arg("seed", t.string, "The shared seed, base32.")],
  result: t.string,
  run: (_ctx, input) =>
    totpCode({
      seed: String(input.args[0] ?? ""),
      at: input.params?.at,
      period: input.params?.period,
      digits: input.params?.digits,
    }),
});
