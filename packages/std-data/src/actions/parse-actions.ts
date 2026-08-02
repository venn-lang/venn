import { VennError } from "@venn-lang/contracts";
import { type ActionDefinition, arg, defineAction, PLUGIN_CODES } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { parseCsv } from "../csv/index.js";

/**
 * `data.csv(text)`: parse an inline CSV string into a list of `data.Row`.
 *
 * The first line names the columns. Every cell arrives as a string.
 */
export const csv: ActionDefinition = defineAction({
  name: "csv",
  doc: "Parse an inline CSV string into an array of row objects (first line = headers).",
  args: [arg("text", t.string, "The CSV itself. Its first line names the columns.")],
  result: t.list(t.ref("data.Row")),
  run: (_ctx, input) => parseCsv(String(input.args[0] ?? "")),
});

/**
 * `data.json(text)`: parse a JSON string into a value.
 *
 * Text nobody promised was JSON is `json.tryParse`, which answers with nothing.
 * This one was promised, so text that is not JSON ends the run, and says so in
 * the language's words rather than the runtime's.
 */
export const json: ActionDefinition = defineAction({
  name: "json",
  doc: "Parse a JSON string into a value. Fails when the text is not JSON.",
  // The result is `dynamic` on purpose: only the text knows its shape, and
  // guessing one here would make the checker enforce the guess.
  args: [arg("text", t.string, "The JSON to read.")],
  result: t.dynamic,
  run: (_ctx, input) => read(String(input.args[0] ?? "null")),
});

function read(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new VennError({
      code: PLUGIN_CODES.VN7003_UNREADABLE,
      message: `This is not JSON: ${(error as Error).message}.`,
    });
  }
}
