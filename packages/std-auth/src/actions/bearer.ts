import { type ActionDefinition, arg, defineAction } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";

/** `auth.bearer(token)`: an `Authorization: Bearer …` header. Pure, no network. */
export const bearer: ActionDefinition = defineAction({
  name: "bearer",
  doc: "Build an Authorization header for a bearer token.",
  args: [arg("token", t.string, "The token to carry.")],
  result: t.ref("auth.Headers"),
  run: (_ctx, input) => ({ Authorization: `Bearer ${String(input.args[0] ?? "")}` }),
});
