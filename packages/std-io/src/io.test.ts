import { createMemoryConsole, type MemoryConsole } from "@venn-lang/contracts";
import type { ActionContext, ActionDefinition } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { ioPlugin } from "./plugin.js";

/** Every verb the plugin publishes, which is where a name is looked up. */
const actions = ioPlugin.actions ?? [];

import { ConsolePort } from "./port/index.js";

function action(name: string): ActionDefinition {
  const found = actions.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`no io.${name}`);
  return found;
}

/**
 * `show` here only has to be present. What it answers is the language's, not
 * this plugin's, and `one-way-to-write-a-value.test.ts` holds it by running both
 * spellings against the real renderer.
 */
function run(args: { name: string; console: MemoryConsole; values?: unknown[] }): unknown {
  const ctx = {
    port: () => args.console,
    show: (value: unknown) => String(value),
  } as unknown as ActionContext;
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
