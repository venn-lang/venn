import { type ActionDefinition, arg, defineAction } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { parseJson } from "../parse/parse-json.js";

/**
 * The verbs of the `json` namespace: text in, a value out.
 *
 * Writing a value out is `fmt.json`, which is where rendering lives; this is the
 * other direction, and the two never overlap. What comes back is `dynamic`,
 * because text says nothing about its own shape until an annotation does.
 */
export const jsonActions: ActionDefinition[] = [
  defineAction({
    name: "parse",
    doc: "Read JSON text into a value. Fails with the line and column when it is not JSON.",
    args: [arg("text", t.string, "The text to read.")],
    result: t.dynamic,
    run: (_ctx, input) => taken(String(input.args[0] ?? "")),
  }),
  defineAction({
    name: "tryParse",
    doc: "The same, answering null instead of failing. For text nobody promised was JSON.",
    args: [arg("text", t.string, "The text to read.")],
    result: t.dynamic,
    run: (_ctx, input) => {
      const found = parseJson(String(input.args[0] ?? ""));
      return found.ok ? found.value : null;
    },
  }),
  defineAction({
    name: "isValid",
    doc: "Whether the text is JSON at all, without keeping what it says.",
    args: [arg("text", t.string, "The text to check.")],
    result: t.bool,
    run: (_ctx, input) => parseJson(String(input.args[0] ?? "")).ok,
  }),
];

/** The value, or the reason it is not one, raised where the call was written. */
function taken(text: string): unknown {
  const found = parseJson(text);
  if (found.ok) return found.value;
  throw new Error(`This is not JSON: ${found.reason}.`);
}
