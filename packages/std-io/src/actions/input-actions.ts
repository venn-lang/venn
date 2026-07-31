import { type ActionDefinition, arg, defineAction } from "@venn-lang/sdk";
import { type TypeSpec, t } from "@venn-lang/types";
import { ConsolePort } from "../port/index.js";

/** The shape a keypress arrives as, which is what a program branches on. */
export const KEY_TYPE: TypeSpec = t.record({
  name: t.string,
  text: t.string,
  ctrl: t.bool,
  alt: t.bool,
  shift: t.bool,
});

/**
 * Reading: a line, a key, or everything at once.
 *
 * A program that asks a question needs the answer, and one that draws needs the
 * key as it is pressed rather than when a line is finished. Both wait, which is
 * the point: nobody asks without wanting to be answered.
 */
export const inputActions: ActionDefinition[] = [
  defineAction({
    name: "readLine",
    doc: "Read the next line from standard input, or null at end of input.",
    result: t.union(t.string, t.null),
    run: (ctx) => ctx.port(ConsolePort).readLine(),
  }),
  defineAction({
    name: "readAll",
    doc: "Everything left on standard input, which is how a pipe hands over.",
    result: t.string,
    run: (ctx) => ctx.port(ConsolePort).readAll(),
  }),
  defineAction({
    name: "readKey",
    doc: "The next keypress, as it is pressed. Null at end of input.",
    result: t.union(KEY_TYPE, t.null),
    run: (ctx) => ctx.port(ConsolePort).readKey(),
  }),
  defineAction({
    name: "ask",
    doc: "Write a question and read the answer, which is the two of them at once.",
    args: [arg("question", t.string, "Written as it is, with no newline after it.")],
    result: t.union(t.string, t.null),
    run: async (ctx, input) => {
      const console = ctx.port(ConsolePort);
      console.write(String(input.args[0] ?? ""));
      return console.readLine();
    },
  }),
];
