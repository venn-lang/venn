import { describe, expect, it } from "vitest";
import type { Console, ScreenOp, TerminalSize } from "./console.types.js";

/** What one implementation has to hand the suite to be put through it. */
export interface ConsoleSpec {
  name: string;
  /** A console reading the given lines, or nothing at all. */
  factory: (input?: readonly string[]) => Console & { out?: string };
  /**
   * One attached to a terminal of this size, when the implementation can be.
   * Without it the terminal half of the suite is skipped: a console that is
   * never a terminal is a valid console, and a pipe is exactly that.
   */
  terminal?: (size: TerminalSize) => Console & { out?: string; ops?: readonly ScreenOp[] };
}

/**
 * The {@link Console} TCK.
 *
 * `out` is optional on the spec so an implementation that cannot be read back
 * still runs the input half of the suite.
 */
export function consoleConformance(spec: ConsoleSpec): void {
  describe(`Console · ${spec.name}`, () => {
    reading(spec);
    writing(spec);
    if (spec.terminal) terminal({ ...spec, terminal: spec.terminal });
  });
}

function reading(spec: ConsoleSpec): void {
  it("reads scripted lines in order, then null at the end", async () => {
    const console = spec.factory(["first", "second"]);

    expect(await console.readLine()).toBe("first");
    expect(await console.readLine()).toBe("second");
    expect(await console.readLine()).toBeNull();
  });

  it("returns null immediately when there is no input", async () => {
    expect(await spec.factory().readLine()).toBeNull();
  });

  it("reads everything left at once", async () => {
    const console = spec.factory(["one", "two", "three"]);

    expect(await console.readAll()).toBe(["one", "two", "three"].join("\n"));
  });

  /** Whatever was already taken is gone: reading twice reads the rest. */
  it("reads the rest, not the whole, once a line has been taken", async () => {
    const console = spec.factory(["one", "two"]);
    await console.readLine();

    expect(await console.readAll()).toBe("two");
  });

  it("reads nothing at all as an empty string", async () => {
    expect(await spec.factory().readAll()).toBe("");
  });
}

function writing(spec: ConsoleSpec): void {
  it("writes without adding a newline of its own", () => {
    const console = spec.factory();
    console.write("a");
    console.write("b");

    if (console.out !== undefined) expect(console.out).toBe("ab");
  });

  /** Not a terminal, so nothing to be asked about and nothing to draw on. */
  it("says it is no terminal, and has no size, when it is not one", () => {
    const console = spec.factory();

    expect(console.isTerminal("out")).toBe(false);
    expect(console.size()).toBeUndefined();
  });

  it("takes a screen operation quietly where there is no screen", () => {
    const console = spec.factory();

    expect(() => console.screen({ kind: "clearScreen" })).not.toThrow();
  });

  it("hands back a way to stop listening that works when nothing ever happens", () => {
    const stop = spec.factory().onResize(() => undefined);

    expect(() => stop()).not.toThrow();
  });
}

function terminal(spec: ConsoleSpec & { terminal: NonNullable<ConsoleSpec["terminal"]> }): void {
  it("answers with the size of the terminal it is attached to", () => {
    const console = spec.terminal({ columns: 80, rows: 24 });

    expect(console.size()).toEqual({ columns: 80, rows: 24 });
    expect(console.isTerminal("out")).toBe(true);
  });

  it("does what it was asked to the screen", () => {
    const console = spec.terminal({ columns: 80, rows: 24 });
    console.screen({ kind: "to", column: 3, row: 5 });
    console.screen({ kind: "hide" });

    // One implementation records the operations and the other writes bytes;
    // both have to have done something, and neither is asked to look alike.
    expect(console.ops?.length ?? console.out?.length ?? 0).toBeGreaterThan(0);
  });
}
