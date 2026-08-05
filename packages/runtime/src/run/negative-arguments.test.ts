import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "./create-runner.js";

/** A plugin that records what a script printed, so the arguments are observable. */
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

/** What the parser reads as a negative argument has to arrive as one. */
describe("a negative argument", () => {
  it("arrives as its own argument, not as a subtraction", async () => {
    const out = await runScript("const a = 5\nio.print a -1");

    expect(out).toEqual(["5 -1"]);
  });

  it("arrives first, or several in a row", async () => {
    expect(await runScript("io.print -1")).toEqual(["-1"]);
    expect(await runScript("const a = 5\nio.print a -1 -2")).toEqual(["5 -1 -2"]);
  });

  it("negates whatever it was written against", async () => {
    const out = await runScript("const a = 5\nconst p = { age: 2 }\nio.print -a -p.age");

    expect(out).toEqual(["-5 -2"]);
  });

  it("is the subtraction when it was bracketed", async () => {
    const out = await runScript("const a = 5\nio.print (a - 1)");

    expect(out).toEqual(["4"]);
  });
});
