import { type ActionContext, type ActionDefinition, arg, defineAction } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { paths, text } from "./host-paths.js";

/**
 * The two questions worth asking before a path is used: whether it stands on
 * its own, and whether it stayed where it was put.
 */
export const questionActions: ActionDefinition[] = [
  defineAction({
    name: "isAbsolute",
    doc: "Whether the path starts somewhere fixed rather than wherever the program happens to be.",
    args: [arg("path", t.string, "The path to ask about.")],
    result: t.bool,
    run: (ctx, input) => paths(ctx).isAbsolute(text(input.args[0])),
  }),
  defineAction({
    name: "isInside",
    doc: "Whether the path is the directory or somewhere under it. What a name from outside is checked against.",
    args: [
      arg("directory", t.string, "The directory it is meant to stay in."),
      arg("path", t.string, "The path to check."),
    ],
    result: t.bool,
    run: (ctx, input) => inside(ctx, input.args),
  }),
];

/**
 * A path is inside a directory when the walk to it never leaves.
 *
 * The walk is the whole of the answer: it works out `..` first, so a name that
 * climbs out is caught wherever the climb was written, and one that lands on
 * another root has no walk at all.
 */
function inside(ctx: ActionContext, args: readonly unknown[]): boolean {
  const here = paths(ctx);
  const walk = here.relative(text(args[0]), text(args[1]));
  if (here.isAbsolute(walk)) return false;
  return walk !== ".." && !walk.startsWith(`..${here.separator}`);
}
