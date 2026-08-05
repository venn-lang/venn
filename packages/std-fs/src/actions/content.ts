import {
  type ActionContext,
  type ActionDefinition,
  arg,
  defineAction,
  fromBytes,
  toBytes,
} from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { files, pathText } from "./host-files.js";

/**
 * A file, whole, in either direction.
 *
 * Whole is the decision. A handle that is opened, read from and closed is four
 * verbs and a value that must not outlive the run, and none of the programs
 * that asked for a filesystem wanted one: they wanted the text of a file they
 * named. Streaming a file too large to hold is a separate verb for a separate
 * day, and it will be easier to add than a handle would be to take away.
 */
export const contentActions: ActionDefinition[] = [
  defineAction({
    name: "read",
    doc: "The whole file as text, read as UTF-8. Fails with VN8010 when it is not there.",
    args: [arg("path", t.string, "The file to read.")],
    result: t.string,
    run: async (ctx, input) => fromBytes(await files(ctx).read(pathText(input.args[0]))),
  }),
  defineAction({
    name: "write",
    doc: "The text as the whole file, replacing what was there. Missing parents are made.",
    args: [
      arg("path", t.string, "The file to write."),
      arg("text", t.string, "What the file should hold, and nothing else."),
    ],
    result: t.void,
    run: (ctx, input) => writeText(ctx, input.args),
  }),
];

/**
 * The text as the whole of a file.
 *
 * `show` rather than `String`, because a program that writes a summary builds
 * it out of values, and a map reaching a file as `[object Object]` is a wrong
 * answer written to disk where nobody sees it happen.
 */
function writeText(ctx: ActionContext, args: readonly unknown[]): Promise<void> {
  const text = args[1] === undefined || args[1] === null ? "" : ctx.show(args[1]);
  return files(ctx).write(pathText(args[0]), toBytes(text));
}
