import { type ActionDefinition, arg, defineAction, restArg } from "@venn/sdk";
import { t } from "@venn/types";
import { ConsolePort } from "../port/index.js";

/** How a printed value becomes text: strings as-is, everything else as JSON. */
function display(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || typeof value !== "object") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function line(args: readonly unknown[]): string {
  return args.map(display).join(" ");
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
    run: (ctx, input) => ctx.port(ConsolePort).write(`${line(input.args)}\n`),
  }),
  defineAction({
    name: "write",
    doc: "Write to standard output with no trailing newline.",
    args: [arg("value", t.dynamic, "What to write. Nothing is added after it.")],
    result: t.void,
    run: (ctx, input) => ctx.port(ConsolePort).write(line(input.args)),
  }),
  defineAction({
    name: "eprint",
    doc: "Write to standard error, followed by a newline.",
    args: [arg("value", t.dynamic, "What to write to stderr.")],
    result: t.void,
    run: (ctx, input) => ctx.port(ConsolePort).writeError(`${line(input.args)}\n`),
  }),
  defineAction({
    name: "readLine",
    doc: "Read the next line from standard input, or null at end of input.",
    result: t.union(t.string, t.null),
    run: (ctx) => ctx.port(ConsolePort).readLine(),
  }),
  defineAction({
    name: "args",
    doc: "The command-line arguments passed to the script.",
    result: t.list(t.string),
    run: (ctx) => [...ctx.port(ConsolePort).args()],
  }),
];
