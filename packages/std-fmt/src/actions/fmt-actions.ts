import { type ActionDefinition, arg, defineAction, optionalArg } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { toCsv } from "../render/csv.js";
import { toJson } from "../render/json.js";
import { toTable } from "../render/table.js";
import { toXml } from "../render/xml.js";
import { toYaml } from "../render/yaml.js";

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function number(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return value === undefined || Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * The verbs of the `fmt` namespace: a value in, a string out.
 *
 * Formatting is kept apart from printing on purpose. The string is a value you
 * can compare in a test, send in a request or write to a file, not something
 * that only ever reaches a terminal.
 *
 * Every verb is positional and none reads an options map, so none declares a
 * params schema: one would put a `{ … }` in the editor's hover that the verb
 * never looks at, and would quietly strip the keys a caller wrote there.
 */
export const fmtActions: ActionDefinition[] = [
  defineAction({
    name: "json",
    doc: "JSON text. `fmt.json(x, 0)` puts it on one line; the default indents by 2.",
    // Anything at all can be serialised, so the first parameter promises nothing.
    args: [
      arg("value", t.dynamic, "What to render."),
      optionalArg("indent", t.number, "Spaces per level. 0 puts it on one line."),
    ],
    result: t.string,
    run: (_ctx, input) => toJson(input.args[0], number(input.args[1], 2)),
  }),
  defineAction({
    name: "table",
    doc: "An aligned ASCII table of a list of records.",
    // The columns are read off the records at runtime, so the element type
    // promises nothing. A lone record is tolerated, but this verb wants a list.
    args: [arg("rows", t.list(t.dynamic), "A list of records. Their keys become the columns.")],
    result: t.string,
    run: (_ctx, input) => toTable(list(input.args[0])),
  }),
  defineAction({
    name: "yaml",
    doc: "YAML text, for a map, a list or a scalar.",
    args: [arg("value", t.dynamic, "What to render.")],
    result: t.string,
    run: (_ctx, input) => toYaml(input.args[0]),
  }),
  defineAction({
    name: "csv",
    doc: "CSV with a header row. `fmt.csv(rows, ';')` changes the separator.",
    args: [
      arg("rows", t.list(t.dynamic), "A list of records. Their keys become the header row."),
      optionalArg("separator", t.string, "What goes between fields. A comma by default."),
    ],
    result: t.string,
    run: (_ctx, input) => toCsv(list(input.args[0]), String(input.args[1] ?? ",")),
  }),
  defineAction({
    name: "xml",
    doc: "XML text. `fmt.xml(x, 'user')` names the root element.",
    args: [
      arg("value", t.dynamic, "What to render."),
      optionalArg("root", t.string, "What to call the outermost element."),
    ],
    result: t.string,
    run: (_ctx, input) => toXml(input.args[0], String(input.args[1] ?? "root")),
  }),
];
