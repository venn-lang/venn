import { createMemoryConsole, type MemoryConsole } from "@venn-lang/contracts";
import type { ActionContext } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { ioPlugin } from "./plugin.js";

const actions = ioPlugin.actions ?? [];

/** Run one verb against a console the test set up, and answer with what it gave. */
async function run(args: {
  name: string;
  console: MemoryConsole;
  args?: readonly unknown[];
}): Promise<unknown> {
  const found = actions.find((candidate) => candidate.name === args.name);
  if (!found) throw new Error(`io.${args.name} is not a verb`);
  const ctx = {
    port: () => args.console,
    show: (value: unknown) => String(value),
  } as unknown as ActionContext;
  return found.run(ctx, { args: args.args ?? [], params: {} });
}

describe("asking the terminal about itself", () => {
  it("answers with its size when there is one", async () => {
    const console = createMemoryConsole({ size: { columns: 80, rows: 24 }, terminal: ["out"] });

    expect(await run({ name: "size", console })).toEqual({ columns: 80, rows: 24 });
  });

  /** A pipe is not a terminal, and a program that draws has to be able to tell. */
  it("answers with nothing when the output is not one", async () => {
    expect(await run({ name: "size", console: createMemoryConsole() })).toBeNull();
  });

  it("says which streams are terminals, one at a time", async () => {
    const console = createMemoryConsole({ terminal: ["out"] });

    expect(await run({ name: "isTerminal", console, args: ["out"] })).toBe(true);
    expect(await run({ name: "isTerminal", console, args: ["in"] })).toBe(false);
  });

  it("asks about the output when nothing says which stream", async () => {
    const console = createMemoryConsole({ terminal: ["out"] });

    expect(await run({ name: "isTerminal", console, args: [] })).toBe(true);
  });

  /**
   * A question with nothing in it writes nothing, rather than the word for
   * nothing. `io.ask()` with no argument is a bare prompt, and `undefined` on
   * the terminal would be the language talking to itself.
   */
  it("writes no question when it was given none", async () => {
    const console = createMemoryConsole();

    await run({ name: "ask", console, args: [] });

    expect(console.out).toBe("");
  });
});

describe("doing something to the screen", () => {
  it("puts the cursor where it was told, counting from one", async () => {
    const console = createMemoryConsole({ terminal: ["out"] });
    await run({ name: "cursor.to", console, args: [3, 5] });

    expect(console.ops).toEqual([{ kind: "to", column: 3, row: 5 }]);
  });

  it("moves it from where it is, in either direction", async () => {
    const console = createMemoryConsole({ terminal: ["out"] });
    await run({ name: "cursor.move", console, args: [-2, 1] });

    expect(console.ops).toEqual([{ kind: "move", columns: -2, rows: 1 }]);
  });

  it("hides it and shows it again", async () => {
    const console = createMemoryConsole({ terminal: ["out"] });
    await run({ name: "cursor.hide", console });
    await run({ name: "cursor.show", console });

    expect(console.ops.map((op) => op.kind)).toEqual(["hide", "show"]);
  });

  it("clears a line and the whole screen", async () => {
    const console = createMemoryConsole({ terminal: ["out"] });
    await run({ name: "clearLine", console });
    await run({ name: "clear", console });

    expect(console.ops.map((op) => op.kind)).toEqual(["clearLine", "clearScreen"]);
  });

  /** Written through a pipe, the same program says its lines and nothing else. */
  it("is quietly ignored where there is no screen", async () => {
    const console = createMemoryConsole();
    await run({ name: "clear", console });

    expect(console.out).toBe("");
  });
});

describe("reading", () => {
  it("asks a question and hands back the answer", async () => {
    const console = createMemoryConsole({ input: ["ada"] });

    expect(await run({ name: "ask", console, args: ["Name? "] })).toBe("ada");
    expect(console.out).toBe("Name? ");
  });

  it("hands back nothing when there is nobody to answer", async () => {
    const console = createMemoryConsole();

    expect(await run({ name: "ask", console, args: ["Name? "] })).toBeNull();
  });

  it("reads everything left at once", async () => {
    const console = createMemoryConsole({ input: ["one", "two"] });

    expect(await run({ name: "readAll", console })).toBe("one\ntwo");
  });

  it("reads one key as it is pressed", async () => {
    const console = createMemoryConsole({ keys: [{ name: "up" }, { name: "a", text: "a" }] });

    expect(await run({ name: "readKey", console })).toEqual({
      name: "up",
      text: "",
      ctrl: false,
      alt: false,
      shift: false,
    });
    expect(await run({ name: "readKey", console })).toEqual(
      expect.objectContaining({ name: "a", text: "a" }),
    );
  });

  it("reads null once there are no keys left", async () => {
    expect(await run({ name: "readKey", console: createMemoryConsole() })).toBeNull();
  });
});
