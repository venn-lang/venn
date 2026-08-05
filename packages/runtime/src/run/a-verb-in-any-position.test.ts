// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Venn source under test.
import { createTestHost } from "@venn-lang/contracts";
import { type ProblemError, parse } from "@venn-lang/core";
import { arg, defineAction, type PluginDefinition, z } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { describe, expect, it } from "vitest";
import { createMemorySink, type MemorySink } from "../eventsink/index.js";
import { createCleanupList } from "../scheduler/index.js";
import { createRunner } from "./create-runner.js";

/** One verb that answers differently depending on the option it was given. */
const MARK = defineAction({
  name: "mark",
  params: z.object({ with: z.string().default("-") }),
  args: [arg("text", t.string, "What to mark.")],
  result: t.string,
  run: (_ctx, input) => `${input.args[0]}${(input.params as { with: string }).with}`,
});

function plugin(out: string[]): PluginDefinition {
  const say = defineAction({
    name: "say",
    args: [arg("text", t.string, "What to say.")],
    result: t.void,
    run: (_ctx, input) => void out.push(String(input.args[0])),
  });
  return { name: "@t/v", namespace: "v", actions: [MARK, say] };
}

interface Ran {
  out: string[];
  sink: MemorySink;
}

async function run(source: string): Promise<Ran> {
  const out: string[] = [];
  const sink = createMemorySink();
  const runner = createRunner({
    host: createTestHost(),
    plugins: [plugin(out)],
    sink,
    cleanup: createCleanupList(),
  });
  await runner.script(parse(`import { v } from "@t/v"\n${source}\n`).ast);
  return { out, sink };
}

/** How many envelopes of one kind the run emitted. */
function counted(sink: MemorySink, kind: string): number {
  return sink.envelopes.filter((one) => one.kind === kind).length;
}

/** The six places one call can be written, each binding what it gave back. */
const EVERY_POSITION = [
  'const bound = v.mark("a", { with: "!" })',
  'const inAList = [v.mark("a", { with: "!" })][0]',
  "const inAString = \"${v.mark('a', { with: '!' })}\"",
  "fn pass(x) => x",
  'const asAnArgument = pass(v.mark("a", { with: "!" }))',
  'const bareword = v.mark "a" { with: "!" }',
  'v.say "${bound}|${inAList}|${inAString}|${asAnArgument}|${bareword}"',
].join("\n");

async function meansTheSameEverywhere(): Promise<void> {
  const { out } = await run(EVERY_POSITION);

  expect(out).toEqual(["a!|a!|a!|a!|a!"]);
}

/**
 * The whole validation layer was absent from expression position: `z.object`
 * drops what it does not know, so the misspelt key was ignored and the call ran
 * with the default.
 */
async function refusesAKeyNobodyDeclared(): Promise<void> {
  const failed = await run('v.say v.mark("a", { withh: "!" })').catch((error) => error);

  expect((failed as ProblemError).problem.code).toBe("VN3001");
  expect((failed as ProblemError).problem.title).toBe(
    '"withh" is not an option here. Did you mean "with"?',
  );
}

/**
 * A verb that ran without being announced is a verb no reporter can show and no
 * timing can account for.
 */
async function announcesItself(): Promise<void> {
  const { sink } = await run('v.say v.mark("a", { with: "!" })');

  expect(counted(sink, "action.started")).toBe(2);
  expect(counted(sink, "action.finished")).toBe(2);
}

describe("a verb called from inside another expression", () => {
  it("means what the same call means as a statement", meansTheSameEverywhere);
  it("refuses an option key the verb never declared", refusesAKeyNobodyDeclared);
  it("announces itself, as the statement form does", announcesItself);
});
