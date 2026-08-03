import { type ActionContext, type ActionDefinition, defineAction, restArg } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { ConsolePort } from "../port/index.js";

/**
 * The values as one line, each written the way the language writes it.
 *
 * The rendering is `ctx.show`, which is the same definition `print`, `str` and
 * `"${…}"` use, because `io.print` claims to be `print` under its full name and
 * a plugin holding a renderer of its own is what made that claim false.
 */
function line(ctx: ActionContext, args: readonly unknown[]): string {
  return args.map((value) => ctx.show(value)).join(" ");
}

/**
 * The verbs of the `io` namespace: standard output, standard error, standard
 * input and the process arguments.
 *
 * Plain `print` is in the prelude and needs no import. `io.print` is the same
 * verb under its full name, so a script that imports the namespace reads the
 * same either way.
 */
export const consoleActions: ActionDefinition[] = [
  defineAction({
    name: "print",
    doc: "Write to standard output with a newline. Same as the prelude's `print`.",
    args: [restArg("values", t.dynamic, "Anything, as many as you like.")],
    result: t.void,
    run: (ctx, input) => ctx.port(ConsolePort).write(`${line(ctx, input.args)}\n`),
  }),
  defineAction({
    name: "write",
    doc: "Write to standard output with no trailing newline.",
    args: [restArg("values", t.dynamic, "Anything, as many as you like. Nothing follows them.")],
    result: t.void,
    run: (ctx, input) => ctx.port(ConsolePort).write(line(ctx, input.args)),
  }),
  defineAction({
    name: "eprint",
    doc: "Write to standard error, followed by a newline.",
    args: [restArg("values", t.dynamic, "Anything, as many as you like.")],
    result: t.void,
    run: (ctx, input) => ctx.port(ConsolePort).writeError(`${line(ctx, input.args)}\n`),
  }),
  defineAction({
    name: "args",
    doc: "The command-line arguments passed to the script.",
    result: t.list(t.string),
    run: (ctx) => [...ctx.port(ConsolePort).args()],
  }),
];
