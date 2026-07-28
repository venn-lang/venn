import { createMemoryConsole, type MemoryConsole } from "@venn/contracts";
import type { ActionContext, ActionDefinition } from "@venn/sdk";
import { describe, expect, it } from "vitest";
import { consoleActions } from "./actions/console-actions.js";
import { ConsolePort } from "./port/index.js";

function action(name: string): ActionDefinition {
  const found = consoleActions.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`no io.${name}`);
  return found;
}

function run(args: { name: string; console: MemoryConsole; values?: unknown[] }): unknown {
  const ctx = { port: () => args.console } as unknown as ActionContext;
  return action(args.name).run(ctx, { args: args.values ?? [], params: {} });
}

describe("io actions", () => {
  it("write adds no newline", () => {
    const console = createMemoryConsole();
    run({ name: "write", console, values: [">"] });

    expect(console.out).toBe(">");
  });

  it("eprint goes to standard error, not standard output", () => {
    const console = createMemoryConsole();
    run({ name: "eprint", console, values: ["boom"] });

    expect(console.err).toBe("boom\n");
    expect(console.out).toBe("");
  });

  it("readLine consumes the scripted input", async () => {
    const console = createMemoryConsole({ input: ["a"] });

    expect(await run({ name: "readLine", console })).toBe("a");
    expect(await run({ name: "readLine", console })).toBeNull();
  });

  it("args exposes the script's arguments as a list", () => {
    const console = createMemoryConsole({ argv: ["--name", "ada"] });

    expect(run({ name: "args", console })).toEqual(["--name", "ada"]);
  });

  it("the port advertises the io capability", () => {
    expect(ConsolePort.requires).toContain("io");
  });
});
