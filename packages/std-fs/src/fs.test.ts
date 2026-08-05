import { createMemoryFs, type FileSystem } from "@venn-lang/contracts";
import { type ActionContext, toBytes } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { fsPlugin } from "./plugin.js";

const actions = fsPlugin.actions ?? [];

/**
 * One verb, run the way a program written in Venn runs it.
 *
 * `show` is the language's renderer and `fs.write` uses it, so the double has
 * to answer that too or the write path is exercised with a stub the real run
 * never sees.
 */
function run(fs: FileSystem, name: string, ...args: unknown[]): unknown {
  const found = actions.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`fs.${name} is not a verb`);
  const port = { port: () => fs, show: (value: unknown) => String(value) };
  const ctx = port as unknown as ActionContext;
  return found.run(ctx, { args, params: {} });
}

describe("a file, whole", () => {
  it("reads back the text that was written", async () => {
    const fs = createMemoryFs();
    await run(fs, "write", "notes/day.txt", "hello");

    expect(await run(fs, "read", "notes/day.txt")).toBe("hello");
  });

  /**
   * The port speaks bytes and the namespace speaks text, so the encoding is
   * this plugin's and nobody else's. Latin-1 in either direction turns an
   * accented name into different letters, silently, in a file on a disk.
   */
  it("reads and writes UTF-8, not the code units of a string", async () => {
    const fs = createMemoryFs();
    await run(fs, "write", "who.txt", "señor ✓");

    expect(await fs.read("who.txt")).toEqual(toBytes("señor ✓"));
    expect(await run(fs, "read", "who.txt")).toBe("señor ✓");
  });

  it("replaces the whole file rather than adding to it", async () => {
    const fs = createMemoryFs();
    await run(fs, "write", "k.txt", "first");
    await run(fs, "write", "k.txt", "second");

    expect(await run(fs, "read", "k.txt")).toBe("second");
  });

  /** A summary built out of values is what a program writes, so it must not read `[object Object]`. */
  it("writes a value the way the language writes it", async () => {
    const fs = createMemoryFs();
    await run(fs, "write", "n.txt", 42);

    expect(await run(fs, "read", "n.txt")).toBe("42");
  });
});

describe("a file that is not there", () => {
  /**
   * The whole of the decision about a missing file: it raises, and it raises
   * with the code the port already owns, so `catch e { … }` sees `e.code`
   * rather than a `null` the caller has to guess the meaning of.
   */
  it("refuses the read with the port's own code and its own sentence", async () => {
    const fs = createMemoryFs();

    await expect(run(fs, "read", "gone.json")).rejects.toMatchObject({
      code: "VN8010",
      message: 'File not found: "gone.json".',
    });
  });

  it("is a question `fs.exists` answers without refusing", async () => {
    const fs = createMemoryFs();

    expect(await run(fs, "exists", "gone.json")).toBe(false);
    await run(fs, "write", "here.json", "{}");
    expect(await run(fs, "exists", "here.json")).toBe(true);
  });
});

describe("what a directory holds", () => {
  it("names one level, saying which of them hold more", async () => {
    const fs = createMemoryFs();
    await run(fs, "write", "data/one.json", "{}");
    await run(fs, "write", "data/nested/two.json", "{}");

    const held = (await run(fs, "list", "data")) as { name: string; directory: boolean }[];

    expect([...held].sort((a, b) => (a.name < b.name ? -1 : 1))).toEqual([
      { name: "nested", directory: true },
      { name: "one.json", directory: false },
    ]);
  });

  /** Asking what is inside something that holds nothing has an answer, and it is not a failure. */
  it("reads a directory that is not there as empty", async () => {
    expect(await run(createMemoryFs(), "list", "nowhere")).toEqual([]);
  });
});

describe("the plugin itself", () => {
  it("is the package `venn/fs` and the namespace `fs`", () => {
    expect(fsPlugin.name).toBe("venn/fs");
    expect(fsPlugin.namespace).toBe("fs");
  });

  /** A host with no disk hears VN2010 once, at load, rather than on the first read. */
  it("asks the host for the `fs` capability", () => {
    expect(fsPlugin.requires).toEqual(["fs"]);
  });

  it("publishes four verbs and no types of its own", () => {
    expect(actions.map((one) => one.name).sort()).toEqual(["exists", "list", "read", "write"]);
    expect(fsPlugin.typeDefs).toBeUndefined();
  });

  /** The editor reads the signature, so a verb without one is a verb it cannot complete. */
  it("gives every verb a signature", () => {
    expect(actions.filter((one) => !one.signature)).toEqual([]);
  });
});
