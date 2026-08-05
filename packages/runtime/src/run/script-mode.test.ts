// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Venn source under test, where ${…} is the language's own interpolation.
import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "./create-runner.js";

/** A plugin that records what a script printed, so the order is observable. */
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

describe("script mode", () => {
  it("executes top-level statements in order", async () => {
    const out = await runScript('io.print "first"\nio.print "second"');

    expect(out).toEqual(["first", "second"]);
  });

  it("runs top-level control flow", async () => {
    const out = await runScript(`
const names = ["a", "b"]
forEach n in names { io.print n }
if 1 < 2 { io.print "yes" }`);

    expect(out).toEqual(["a", "b", "yes"]);
  });

  it("binds top-level let and reads it later", async () => {
    const out = await runScript('const who = "world"\nio.print "hi ${who}"');

    expect(out).toEqual(["hi world"]);
  });

  it("does not run a `flow`, declarations only run when called", async () => {
    const out = await runScript(`
io.print "top"
flow "not run" { step "s" { io.print "inside flow" } }`);

    expect(out).toEqual(["top"]);
  });
});
