import { type ActionContext, type ActionDefinition, arg, defineAction } from "@venn-lang/sdk";
import { type TypeSpec, t } from "@venn-lang/types";
import { files, pathText } from "./host-files.js";

/** One name inside a directory, and whether it holds more. */
export const ENTRY_TYPE: TypeSpec = t.record({ name: t.string, directory: t.bool });

/**
 * The two questions a program asks before it reads: whether the file is there,
 * and what a directory holds.
 *
 * These are the verbs that do not fail. `fs.read` refuses a file that is not
 * there because a missing file is a fact about the world and not a value, which
 * leaves a program needing a way to ask without being refused. That is this.
 */
export const questionActions: ActionDefinition[] = [
  defineAction({
    name: "exists",
    doc: "Whether there is anything at that path. Asks without failing, unlike `fs.read`.",
    args: [arg("path", t.string, "The path to ask about.")],
    result: t.bool,
    run: (ctx, input) => files(ctx).exists(pathText(input.args[0])),
  }),
  defineAction({
    name: "list",
    doc: "What a directory holds, one level deep, each with a name and whether it holds more.",
    args: [arg("directory", t.string, "The directory to look inside.")],
    result: t.list(ENTRY_TYPE),
    run: (ctx, input) => listEntries(ctx, input.args[0]),
  }),
];

/**
 * The names inside a directory, in the order the host reported them.
 *
 * Copied out of the port's readonly array and rebuilt one field at a time: a
 * value the language holds is a value the language may be handed back, and
 * passing the host's own objects through would let a program write to them.
 */
async function listEntries(ctx: ActionContext, directory: unknown): Promise<unknown[]> {
  const found = await files(ctx).list(pathText(directory));
  return found.map((entry) => ({ name: entry.name, directory: entry.directory }));
}
