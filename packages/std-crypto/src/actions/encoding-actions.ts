import { type ActionDefinition, arg, defineAction } from "@venn/sdk";
import { t } from "@venn/types";
import {
  fromBase64,
  fromBase64Url,
  fromBytes,
  toBase64,
  toBase64Url,
  toBytes,
} from "../bytes/index.js";

/** The `crypto.base64.*` and `crypto.base64url.*` verbs, both directions. */
export const encodingActions: ActionDefinition[] = [
  text("base64.encode", "Encode a string as base64.", (value) => toBase64(toBytes(value))),
  text("base64.decode", "Decode base64 back to a string.", (value) => fromBytes(fromBase64(value))),
  text("base64url.encode", "Encode a string as base64url (JWT's flavour).", (value) =>
    toBase64Url(toBytes(value)),
  ),
  text("base64url.decode", "Decode base64url back to a string.", (value) =>
    fromBytes(fromBase64Url(value)),
  ),
];

function text(name: string, doc: string, transform: (value: string) => string): ActionDefinition {
  return defineAction({
    name,
    doc,
    // All four share one shape, a string in and a string out, so the signature
    // lives here instead of being repeated at each call above.
    args: [arg("text", t.string, "What to encode or decode.")],
    result: t.string,
    run: (_ctx, input) => transform(String(input.args[0] ?? "")),
  });
}
