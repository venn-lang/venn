import { type ActionDefinition, arg, defineAction } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";

/**
 * `auth.basic(username, password)`: an `Authorization: Basic …` header.
 *
 * The credentials are base64 of `user:pass`, which is encoding and not secrecy.
 * A password read from `secrets.*` stays redacted in every diagnostic.
 */
export const basic: ActionDefinition = defineAction({
  name: "basic",
  doc: "Build a Basic Authorization header from a username and password.",
  args: [
    arg("username", t.string, "Who is signing in."),
    arg("password", t.string, "Their password. A secret stays redacted."),
  ],
  result: t.ref("auth.Headers"),
  run: (_ctx, input) => basicHeader(String(input.args[0] ?? ""), String(input.args[1] ?? "")),
});

function basicHeader(user: string, pass: string): { Authorization: string } {
  return { Authorization: `Basic ${btoa(`${user}:${pass}`)}` };
}
