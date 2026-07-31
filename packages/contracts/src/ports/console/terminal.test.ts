import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { sequenceFor } from "./ansi.js";
import { createMemoryConsole } from "./memory-console.js";
import { createNodeConsole } from "./node-console.js";

/** A writable that is a terminal, and remembers everything sent to it. */
function terminal(size = { columns: 80, rows: 24 }) {
  const emitter = new EventEmitter();
  const written: string[] = [];
  return {
    written,
    emitter,
    stream: {
      write: (text: string) => void written.push(text),
      isTTY: true,
      columns: size.columns,
      rows: size.rows,
      on: (event: string, listen: () => void) => emitter.on(event, listen),
      off: (event: string, listen: () => void) => emitter.off(event, listen),
    },
  };
}

/** Standard input as a terminal: raw mode is asked for and has to be given back. */
function keyboard() {
  const stream = new PassThrough() as PassThrough & {
    isTTY?: boolean;
    setRawMode?: (on: boolean) => void;
  };
  const raw: boolean[] = [];
  stream.isTTY = true;
  stream.setRawMode = (on: boolean) => void raw.push(on);
  return { stream, raw };
}

describe("the escape sequences a terminal is sent", () => {
  it("puts the cursor at a row and column, in that order", () => {
    expect(sequenceFor({ kind: "to", column: 3, row: 5 })).toBe("\u001b[5;3H");
  });

  it("moves in the direction the sign asks for", () => {
    expect(sequenceFor({ kind: "move", columns: 2, rows: 0 })).toBe("\u001b[2C");
    expect(sequenceFor({ kind: "move", columns: -2, rows: 0 })).toBe("\u001b[2D");
    expect(sequenceFor({ kind: "move", columns: 0, rows: 1 })).toBe("\u001b[1B");
    expect(sequenceFor({ kind: "move", columns: 0, rows: -1 })).toBe("\u001b[1A");
  });

  it("sends nothing for a move of nothing", () => {
    expect(sequenceFor({ kind: "move", columns: 0, rows: 0 })).toBe("");
  });

  it("hides and shows the caret", () => {
    expect(sequenceFor({ kind: "hide" })).toBe("\u001b[?25l");
    expect(sequenceFor({ kind: "show" })).toBe("\u001b[?25h");
  });

  it("clears a line and leaves the cursor at its start", () => {
    expect(sequenceFor({ kind: "clearLine" })).toContain("2K");
    expect(sequenceFor({ kind: "clearLine" })).toContain("1G");
  });

  it("clears the screen and goes home", () => {
    expect(sequenceFor({ kind: "clearScreen" })).toBe("\u001b[2J\u001b[1;1H");
  });
});

describe("the real console, attached to a terminal", () => {
  it("writes the sequence for what it was asked to do", () => {
    const out = terminal();
    const console = createNodeConsole({ stdout: out.stream, stdin: new PassThrough() });
    console.screen({ kind: "hide" });

    expect(out.written).toEqual(["\u001b[?25l"]);
  });

  it("writes nothing to a stream that is not one", () => {
    const written: string[] = [];
    const console = createNodeConsole({
      stdout: { write: (text: string) => void written.push(text) },
      stdin: new PassThrough(),
    });
    console.screen({ kind: "clearScreen" });

    expect(written).toEqual([]);
  });

  it("hears a resize, and stops hearing it when told to", () => {
    const out = terminal();
    const console = createNodeConsole({ stdout: out.stream, stdin: new PassThrough() });
    const heard: unknown[] = [];
    const stop = console.onResize((size) => heard.push(size));
    out.emitter.emit("resize");
    stop();
    out.emitter.emit("resize");

    expect(heard).toEqual([{ columns: 80, rows: 24 }]);
  });

  it("says which stream is a terminal, one at a time", () => {
    const out = terminal();
    const input = keyboard();
    const console = createNodeConsole({ stdout: out.stream, stdin: input.stream });

    expect(console.isTerminal("out")).toBe(true);
    expect(console.isTerminal("in")).toBe(true);
    expect(console.isTerminal("err")).toBe(false);
  });

  /** Raw mode is what makes a key arrive when pressed, and it has to go back. */
  it("reads one key, and puts the terminal back the way it was", async () => {
    const input = keyboard();
    const console = createNodeConsole({ stdin: input.stream, stdout: terminal().stream });
    const pressed = console.readKey();
    input.stream.write("a");

    expect(await pressed).toEqual(expect.objectContaining({ name: "a", text: "a" }));
    expect(input.raw).toEqual([true, false]);
  });

  it("reads a key that types nothing as itself", async () => {
    const input = keyboard();
    const console = createNodeConsole({ stdin: input.stream, stdout: terminal().stream });
    const pressed = console.readKey();
    input.stream.write("\u001b[A");

    expect(await pressed).toEqual(expect.objectContaining({ name: "up", text: "" }));
  });

  it("reads everything a pipe hands over", async () => {
    const stdin = new PassThrough();
    const console = createNodeConsole({ stdin, stdout: terminal().stream });
    stdin.end("one\ntwo\n");

    expect(await console.readAll()).toBe("one\ntwo");
  });
});

describe("the fake terminal", () => {
  it("tells every listener it was resized, until they leave", () => {
    const console = createMemoryConsole({ size: { columns: 10, rows: 2 } });
    const heard: unknown[] = [];
    const stop = console.onResize((size) => heard.push(size));
    console.resize({ columns: 20, rows: 4 });
    stop();
    console.resize({ columns: 30, rows: 6 });

    expect(heard).toEqual([{ columns: 20, rows: 4 }]);
    expect(console.size()).toEqual({ columns: 30, rows: 6 });
  });
});
