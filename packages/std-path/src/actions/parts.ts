import { type ActionContext, type ActionDefinition, arg, defineAction } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { paths, text } from "./host-paths.js";

/**
 * The verbs that take a path apart: its parent, its name, its extension, and
 * the parts it is made of.
 *
 * All of it is answered by reading the path, never by touching a disk. A file
 * that does not exist yet still has a name and a parent, and asking about them
 * is how a program works out whether to make it.
 */
export const partActions: ActionDefinition[] = [
  defineAction({
    name: "dirname",
    doc: "Everything but the last part. A path with only one part has no parent, which reads `.`.",
    args: [arg("path", t.string, "The path to take apart.")],
    result: t.string,
    run: (ctx, input) => paths(ctx).dirname(text(input.args[0])),
  }),
  defineAction({
    name: "basename",
    doc: "The last part, extension and all.",
    args: [arg("path", t.string, "The path to take apart.")],
    result: t.string,
    run: (ctx, input) => paths(ctx).basename(text(input.args[0])),
  }),
  defineAction({
    name: "stem",
    doc: "The last part without its extension, which is the name a program names things after.",
    args: [arg("path", t.string, "The path to take apart.")],
    result: t.string,
    run: (ctx, input) => stemOf(ctx, text(input.args[0])),
  }),
  defineAction({
    name: "extension",
    doc: "The last dot and what follows it, or nothing. A leading dot is a name, not an extension.",
    args: [arg("path", t.string, "The path to take apart.")],
    result: t.string,
    run: (ctx, input) => paths(ctx).extension(text(input.args[0])),
  }),
  defineAction({
    name: "withExtension",
    doc: "The same path, ending in another extension. How an output is named after its input.",
    args: [
      arg("path", t.string, "The path to rename."),
      arg("extension", t.string, "The new one, with or without its dot. Empty takes it off."),
    ],
    result: t.string,
    run: (ctx, input) => renamed(ctx, input.args),
  }),
  defineAction({
    name: "split",
    doc: "The parts, in order, with the separators gone. An absolute path keeps its root as the first.",
    args: [arg("path", t.string, "The path to take apart.")],
    result: t.list(t.string),
    run: (ctx, input) => [...paths(ctx).split(text(input.args[0]))],
  }),
];

function stemOf(ctx: ActionContext, path: string): string {
  const name = paths(ctx).basename(path);
  return name.slice(0, name.length - paths(ctx).extension(path).length);
}

/** An empty extension takes the old one off rather than leaving a bare dot. */
function renamed(ctx: ActionContext, args: readonly unknown[]): string {
  const [path, wanted] = [text(args[0]), text(args[1])];
  const suffix = wanted === "" || wanted.startsWith(".") ? wanted : `.${wanted}`;
  return paths(ctx).join([paths(ctx).dirname(path), stemOf(ctx, path) + suffix]);
}
