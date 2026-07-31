import {
  type ActionContext,
  type ActionDefinition,
  arg,
  defineAction,
  restArg,
} from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { paths, text, textOf } from "./host-paths.js";

/**
 * The verbs that make a path: putting parts together, and saying where they
 * lead from.
 *
 * Nothing here takes a separator, because nothing that uses one should have to
 * know which one this host writes.
 */
export const buildActions: ActionDefinition[] = [
  defineAction({
    name: "join",
    doc: "The parts as one path, with exactly one separator between each.",
    args: [restArg("parts", t.string, "The parts, in order. Empty ones are skipped.")],
    result: t.string,
    run: (ctx, input) => paths(ctx).join(textOf(input.args)),
  }),
  defineAction({
    name: "resolve",
    doc: "The parts as one absolute path, starting from the current directory if none is.",
    args: [restArg("parts", t.string, "The parts, in order.")],
    result: t.string,
    run: (ctx, input) => paths(ctx).resolve(textOf(input.args)),
  }),
  defineAction({
    name: "normalize",
    doc: "The same path with `.` and `..` worked out and the separators tidied.",
    args: [arg("path", t.string, "The path to tidy.")],
    result: t.string,
    run: (ctx, input) => paths(ctx).normalize(text(input.args[0])),
  }),
  defineAction({
    name: "relative",
    doc: "How to get from one path to the other, going up with `..` where it has to.",
    args: [arg("from", t.string, "Where the walk starts."), arg("to", t.string, "Where it ends.")],
    result: t.string,
    run: (ctx, input) => walk(ctx, input.args),
  }),
  defineAction({
    name: "cwd",
    doc: "Where the program is running from. Every relative path starts here.",
    result: t.string,
    run: (ctx) => paths(ctx).cwd(),
  }),
];

function walk(ctx: ActionContext, args: readonly unknown[]): string {
  return paths(ctx).relative(text(args[0]), text(args[1]));
}
