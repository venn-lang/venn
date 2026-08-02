import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/index.js";

async function ran(source: string): Promise<string[]> {
  const out: string[] = [];
  const printer = definePlugin({
    name: "@t/io",
    version: "0",
    namespace: "io",
    actions: [
      defineAction({
        name: "print",
        run: (_ctx, input) => void out.push(input.args.map(String).join(" ")),
      }),
    ],
  });
  const runner = createRunner({
    host: createTestHost(),
    plugins: [printer],
    sink: createMemorySink(),
  });
  await runner.script(parse(source).ast);
  return out;
}

/**
 * A variable that can be given a new value.
 *
 * Every shape that was not a fold had to be bent into one, and the two
 * constructs that most want to hand a value outward, `try` and `if`, are
 * statements, so neither could produce one at all.
 */
describe("giving a name a new value", () => {
  it("changes what the name holds", async () => {
    expect(await ran("let total = 0\ntotal = 5\nio.print(total)")).toEqual(["5"]);
  });

  it("accumulates across a loop, which is what could not be written", async () => {
    const source = "let sum = 0\nforEach n in [1, 2, 3] {\n  sum = sum + n\n}\nio.print(sum)";

    expect(await ran(source)).toEqual(["6"]);
  });

  /** The binding the block can see, not a new one beside it. */
  it("writes the binding a block was standing in, not a local of its own", async () => {
    const source = "let found = 0\nif true {\n  found = 7\n}\nio.print(found)";

    expect(await ran(source)).toEqual(["7"]);
  });

  it("takes what the name holds on the right of itself", async () => {
    expect(await ran("let n = 2\nn = n * n\nio.print(n)")).toEqual(["4"]);
  });
});

describe("writing into what a name holds", () => {
  it("changes a field", async () => {
    const source = 'const m = { name: "old" }\nm.name = "new"\nio.print(m.name)';

    expect(await ran(source)).toEqual(["new"]);
  });

  it("changes an item", async () => {
    expect(await ran("const xs = [1, 2, 3]\nxs[0] = 99\nio.print(xs[0])")).toEqual(["99"]);
  });

  it("changes a field of a field", async () => {
    const source =
      'const m = { user: { name: "old" } }\nm.user.name = "new"\nio.print(m.user.name)';

    expect(await ran(source)).toEqual(["new"]);
  });

  /** A map is one thing, named in more than one place: every holder sees it. */
  it("is seen by everything else holding that value", async () => {
    const source = "const m = { a: 1 }\nconst also = m\nm.a = 2\nio.print(also.a)";

    expect(await ran(source)).toEqual(["2"]);
  });
});

const NEWLINE = String.fromCharCode(10);

describe("writing into what is not a place", () => {
  /** Nothing is not a map, so there is no field of it to fill in. */
  it("refuses a field of nothing", async () => {
    await expect(
      ran(["let x = null", "x.a = 1", "io.print(x)"].join(NEWLINE)),
    ).rejects.toMatchObject({
      problem: { code: "VN3021" },
    });
  });

  it("refuses a field of a number", async () => {
    await expect(
      ran(["const m = { a: 1 }", "m.a.b = 2", "io.print(m)"].join(NEWLINE)),
    ).rejects.toMatchObject({
      problem: { code: "VN3021" },
    });
  });
});

/**
 * What a closure captures.
 *
 * The binding, not a copy of what it held. That falls out of how the kernel
 * already works: a compiled function addresses a cell, and an assignment writes
 * through that same cell.
 */
describe("what a function sees afterwards", () => {
  it("reads what the assignment left, not what the name held when it was made", async () => {
    const source = "let n = 1\nconst read = () => n\nn = 42\nio.print(read())";

    expect(await ran(source)).toEqual(["42"]);
  });

  it("changes a name across passes of a loop", async () => {
    const source = [
      "let seen = 0",
      "forEach n in [1, 2, 3] {",
      "  if n > 1 {",
      "    seen = seen + n",
      "  }",
      "}",
      "io.print(seen)",
    ].join("\n");

    expect(await ran(source)).toEqual(["5"]);
  });

  /** A fragment reads the file it was written in, so it writes it too. */
  it("changes a name from inside a fragment", async () => {
    const source = [
      "let seen = 0",
      "fragment tick() {",
      "  seen = seen + 1",
      "}",
      "run tick()",
      "run tick()",
      "io.print(seen)",
    ].join(NEWLINE);

    expect(await ran(source)).toEqual(["2"]);
  });

  /** A parameter is a binding like any other, so it takes a new value too. */
  it("lets a parameter be given one", async () => {
    const source = [
      "fragment twice(n) {",
      "  n = n * 2",
      "  io.print(n)",
      "}",
      "run twice(5)",
    ].join("\n");

    expect(await ran(source)).toEqual(["10"]);
  });
});
