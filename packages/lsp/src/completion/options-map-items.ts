import type { ParamSpec } from "@venn-lang/sdk";
import type { Range } from "vscode-languageserver";
import { type CompletionItem, InsertTextFormat } from "vscode-languageserver";
import { ICON } from "./icons.js";

/**
 * Where a verb's options are due: offer the map itself, then its keys.
 *
 * At `http.get("u", ▮)` the braces have to exist before anything can go inside
 * them, so the map comes first and the keys after. Accepting either writes
 * `{ headers: … }` in a single step.
 */
export function optionsMapItems(options: readonly ParamSpec[], range: Range): CompletionItem[] {
  return [wholeMap(options, range), ...options.map((spec) => keyItem(spec, range))];
}

/** `{ … }`: the options map, with the required keys already in place. */
function wholeMap(options: readonly ParamSpec[], range: Range): CompletionItem {
  const required = options.filter((spec) => spec.required);
  const inner = (required.length > 0 ? required : options.slice(0, 1))
    .map((spec, index) => `${spec.name}: \${${index + 1}:${spec.type}}`)
    .join(", ");
  return {
    label: "{ … }",
    kind: ICON.key,
    detail: `options of this call, ${options.map((spec) => spec.name).join(", ")}`,
    insertText: `{ ${inner} }`,
    insertTextFormat: InsertTextFormat.Snippet,
    textEdit: { range, newText: `{ ${inner} }` },
    sortText: "0",
  };
}

/** One key, written into a fresh map so it lands somewhere valid. */
function keyItem(spec: ParamSpec, range: Range): CompletionItem {
  const text = `{ ${spec.name}: $1 }`;
  return {
    label: spec.name,
    kind: ICON.key,
    detail: spec.required ? `${spec.type} (required)` : spec.type,
    documentation: spec.doc,
    insertText: text,
    insertTextFormat: InsertTextFormat.Snippet,
    textEdit: { range, newText: text },
    sortText: `1${spec.name}`,
  };
}
