import { type ActionDefinition, arg, defineAction, toBase64, toBytes } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";

/**
 * `auth.basic(username, password)`: an `Authorization: Basic …` header.
 *
 * The credentials are base64 of the UTF-8 bytes of `user:pass`, which RFC 7617
 * §2 requires and `btoa` cannot do. `btoa` read the string one code unit at a
 * time: an accented password went out as latin-1, which is different bytes, so
 * the server answered 401 and nothing in Venn said why, and anything above
 * U+00FF threw a `DOMException` with no code, no line and no product voice.
 * Encoding, not secrecy: a password read from `secrets.*` stays redacted in
 * every diagnostic.
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
  return { Authorization: `Basic ${toBase64(toBytes(`${user}:${pass}`))}` };
}
