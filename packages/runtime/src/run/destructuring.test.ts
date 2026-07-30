import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "./create-runner.js";

/** A plugin that records what a script printed, so the bindings are observable. */
function recorder(sink: string[]) {
  return definePlugin({
    name: "@t/io",
    version: "0",
    namespace: "io",
    actions: [
      defineAction({
        name: "print",
        run: (_ctx, input) => {
          sink.push(input.args.map(String).join(" "));
        },
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

const ORDER = 'const order = { id: "a1", total: 42 }\n';

describe("what a pattern binds when it runs", () => {
  it("binds each field under its own name", async () => {
    const out = await runScript(`${ORDER}const { id, total } = order\nio.print id total`);

    expect(out).toEqual(["a1 42"]);
  });

  it("binds a field under another name", async () => {
    const out = await runScript(`${ORDER}const { id: reference } = order\nio.print reference`);

    expect(out).toEqual(["a1"]);
  });

  it("binds by position out of a list", async () => {
    const out = await runScript("const [a, b] = [1, 2]\nio.print a b");

    expect(out).toEqual(["1 2"]);
  });

  it("goes on taking apart what it took apart", async () => {
    const source = `const u = { name: "ana", city: { name: "porto" } }
const { city: { name: town } } = u
io.print town`;

    expect(await runScript(source)).toEqual(["porto"]);
  });

  /** The checker says so where it is written; the run has nothing to hand over. */
  it("binds nothing at all as null", async () => {
    const out = await runScript(`${ORDER}const { nope } = order\nio.print nope`);

    expect(out).toEqual(["null"]);
  });

  it("takes apart what a loop hands over, once per item", async () => {
    const source = `const people = [{ name: "ana" }, { name: "bea" }]
forEach { name } in people {
  io.print name
}`;

    expect(await runScript(source)).toEqual(["ana", "bea"]);
  });

  it("takes apart a parameter of a function", async () => {
    const source = `fn label({ name, age }) => "\${name}/\${age}"
io.print label({ name: "cai", age: 7 })`;

    expect(await runScript(source)).toEqual(["cai/7"]);
  });

  /** The body is compiled, so its locals are slots: a pattern fills several. */
  it("takes apart a local of a function body", async () => {
    const source = `fn sum(o) {
  let { a, b } = o
  return a + b
}
io.print sum({ a: 1, b: 2 })`;

    expect(await runScript(source)).toEqual(["3"]);
  });

  it("keeps the parameters in their places while it unpacks", async () => {
    const source = `fn describe(before, { name }, after) => "\${before} \${name} \${after}"
io.print describe(1, { name: "ana" }, 2)`;

    expect(await runScript(source)).toEqual(["1 ana 2"]);
  });

  it("takes apart what a fragment was called with", async () => {
    const source = `fragment show({ name }) {
  io.print name
}
run show({ name: "ana" })`;

    expect(await runScript(source)).toEqual(["ana"]);
  });

  /** The pool takes another way through the loop, and binds the same way. */
  it("takes apart what a loop hands over, several at a time", async () => {
    const source = `const people = [{ name: "ana" }, { name: "bea" }]
forEach { name } in people { concurrency: 2 } {
  io.print name
}`;

    expect((await runScript(source)).sort()).toEqual(["ana", "bea"]);
  });

  it("takes apart a binding inside a block", async () => {
    const source = `${ORDER}forEach x in [1] {
  const { id } = order
  io.print id
}`;

    expect(await runScript(source)).toEqual(["a1"]);
  });
});
