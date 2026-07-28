import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { arg, defineAction, definePlugin, restArg, z } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createCleanupList } from "../scheduler/index.js";
import { createRunner } from "./create-runner.js";

/** A plugin that records exactly what each verb was handed. */
function plugin(seen: unknown[]) {
  return definePlugin({
    name: "@t/v",
    version: "0",
    namespace: "v",
    actions: [
      defineAction({
        name: "send",
        params: z.object({ tag: z.string().optional() }).optional(),
        args: [arg("url", t.string, "Where to send it.")],
        result: t.void,
        run: (_ctx, input) => void seen.push({ args: input.args, params: input.params }),
      }),
      // Its one argument *is* a map, which must never be read as configuration.
      defineAction({
        name: "seed",
        params: z.object({ tag: z.string().optional() }).optional(),
        args: [arg("rows", t.map(t.dynamic), "The rows to load.")],
        result: t.void,
        run: (_ctx, input) => void seen.push({ args: input.args, params: input.params }),
      }),
      // It takes every argument it is given, so nothing is ever left over.
      defineAction({
        name: "any",
        params: z.object({ tag: z.string().optional() }).optional(),
        args: [restArg("values", t.dynamic, "Anything, as many as you like.")],
        result: t.void,
        run: (_ctx, input) => void seen.push({ args: input.args, params: input.params }),
      }),
    ],
  });
}

async function run(source: string): Promise<unknown[]> {
  const seen: unknown[] = [];
  const runner = createRunner({
    host: createTestHost(),
    plugins: [plugin(seen)],
    sink: createMemorySink(),
    cleanup: createCleanupList(),
  });
  await runner.script(parse(`${source}\n`).ast);
  return seen;
}

/**
 * One call, two spellings, one meaning.
 *
 * The trailing `{ … }` is the options in both, but only the bareword form puts
 * it where the parser can label it. Unsplit, the bracketed form arrives as an
 * ordinary argument nobody looks at, so `http.get(url, { headers })` sends no
 * headers and looks exactly like a call that worked.
 */
describe("the two ways of spelling a call", () => {
  it("agrees about the options", async () => {
    const [bare, called] = await run(
      ['v.send "u" { tag: "a" }', 'v.send("u", { tag: "a" })'].join("\n"),
    );

    expect(bare).toEqual({ args: ["u"], params: { tag: "a" } });
    expect(called).toEqual(bare);
  });

  it("agrees when there are no options", async () => {
    const [bare, called] = await run(['v.send "u"', 'v.send("u")'].join("\n"));

    expect(called).toEqual(bare);
  });

  /** A map the verb asked for is an argument; the editor must not steal it. */
  it("leaves an argument that is itself a map alone", async () => {
    const [seeded] = await run("v.seed({ users: [1] })");

    expect(seeded).toEqual({ args: [{ users: [1] }], params: {} });
  });

  it("still reads a map past that one as the options", async () => {
    const [seeded] = await run('v.seed({ users: [1] }, { tag: "b" })');

    expect(seeded).toEqual({ args: [{ users: [1] }], params: { tag: "b" } });
  });

  /** A verb that takes everything has nothing left over to configure it with. */
  it("hands a variadic verb every argument, map or not", async () => {
    const [any] = await run("v.any(1, { two: 2 })");

    expect(any).toEqual({ args: [1, { two: 2 }], params: {} });
  });
});
