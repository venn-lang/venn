import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "./create-runner.js";

/**
 * A plugin that records what a script printed, and one verb that answers late,
 * so a literal holding a value it is still waiting for can be observed.
 */
function recorder(sink: string[]) {
  return definePlugin({
    name: "@t/io",
    namespace: "io",
    actions: [
      defineAction({
        name: "print",
        run: (_ctx, input) => {
          sink.push(input.args.map(String).join(" "));
        },
      }),
      defineAction({
        name: "later",
        run: async (_ctx, input) => input.args[0],
      }),
    ],
  });
}

async function runScript(source: string): Promise<string[]> {
  const out: string[] = [];
  const runner = createRunner({
    host: createTestHost(),
    plugins: [recorder(out)],
    sink: createMemorySink(),
  });
  await runner.script(parse(source).ast);
  return out;
}

describe("pouring a list into a list", () => {
  it("keeps the order it was written in", async () => {
    const source = `const xs = [1, 2]
io.print([0, ...xs, 5].join("-"))`;

    expect(await runScript(source)).toEqual(["0-1-2-5"]);
  });

  it("pours more than one", async () => {
    const source = `const xs = [1, 2]
io.print([...xs, ...xs].join("-"))`;

    expect(await runScript(source)).toEqual(["1-2-1-2"]);
  });

  it("pours an empty one, and nothing shows", async () => {
    const source = `const xs = []
io.print([0, ...xs].len)`;

    expect(await runScript(source)).toEqual(["1"]);
  });

  /** The checker refuses what it knows; the run adds nothing it cannot pour. */
  it("adds nothing at all for what is not a list", async () => {
    const source = `fn take(x) => [0, ...x]
io.print(take(5).len)`;

    expect(await runScript(source)).toEqual(["1"]);
  });

  it("waits for an item that has not arrived", async () => {
    const source = `const xs = [1, 2]
io.print([...xs, io.later(3)].join("-"))`;

    expect(await runScript(source)).toEqual(["1-2-3"]);
  });
});

describe("pouring a map into a map", () => {
  it("carries the fields of both", async () => {
    const source = `const a = { x: 1 }
const b = { y: 2 }
io.print({ ...a, ...b }.len)`;

    expect(await runScript(source)).toEqual(["2"]);
  });

  /** Later wins, whichever side it was written on. */
  it("gives a key written after the spread to what was written last", async () => {
    const source = `const a = { x: 1 }
io.print({ ...a, x: 9 }.x, { x: 9, ...a }.x)`;

    expect(await runScript(source)).toEqual(["9 1"]);
  });

  it("adds nothing at all for what is not a map", async () => {
    const source = `fn take(x) => { a: 1, ...x }
io.print(take(5).len)`;

    expect(await runScript(source)).toEqual(["1"]);
  });

  it("waits for a value that has not arrived", async () => {
    const source = `const a = { x: 1 }
io.print({ ...a, y: io.later(2) }.y)`;

    expect(await runScript(source)).toEqual(["2"]);
  });
});

describe("merging by name", () => {
  it("is the same answer the spread gives", async () => {
    const source = `const a = { x: 1, y: 2 }
const b = { y: 9, z: 3 }
io.print(a.merge(b).y, { ...a, ...b }.y)`;

    expect(await runScript(source)).toEqual(["9 9"]);
  });

  it("goes into a nested map only when told to", async () => {
    const source = `const a = { inner: { x: 1 } }
const b = { inner: { y: 2 } }
io.print(a.mergeDeep(b).inner.len, a.merge(b).inner.len)`;

    expect(await runScript(source)).toEqual(["2 1"]);
  });
});

describe("a verb that takes any number of one thing", () => {
  it("appends every one of them", async () => {
    const source = `const xs = [1, 2]
io.print(xs.push(3, 4).join("-"))`;

    expect(await runScript(source)).toEqual(["1-2-3-4"]);
  });
});
