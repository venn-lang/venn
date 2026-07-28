import { type ActionDefinition, arg, defineAction } from "@venn/sdk";
import { t } from "@venn/types";
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
 * Throws whatever `JSON.parse` throws when the text is not valid JSON.
 */
export const json: ActionDefinition = defineAction({
  name: "json",
  doc: "Parse a JSON string into a value.",
  // The result is `dynamic` on purpose: only the text knows its shape, and
  // guessing one here would make the checker enforce the guess.
  args: [arg("text", t.string, "The JSON to read.")],
  result: t.dynamic,
  run: (_ctx, input) => JSON.parse(String(input.args[0] ?? "null")),
});
