import {
  type Console,
  ConsolePort,
  createMemoryConsole,
  createTestHost,
} from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { createMemorySink, createRunner, type Runner } from "@venn-lang/runtime";
import { describe, expect, it } from "vitest";
import { allPlugins } from "./plugins.js";

const NEWLINE = String.fromCharCode(10);

/** A run of its own: its own host, so its own stream, as a second process has. */
function runnerFor(args: { console: Console; flow?: string }): Runner {
  return createRunner({
    host: createTestHost(),
    plugins: allPlugins,
    sink: createMemorySink(),
    ports: [{ port: ConsolePort, impl: args.console }],
    filter: args.flow === undefined ? {} : { flow: args.flow },
  });
}

async function run(source: string, flow?: string): Promise<string[]> {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  const console = createMemoryConsole();
  await runnerFor({ console, flow }).run(ast);
  return console.out.split(NEWLINE).filter((line) => line !== "");
}

const TWO_FLOWS = [
  'import { data } from "venn/data"',
  'import { math } from "venn/math"',
  'flow "alpha" { print "${data.faker.uuid()} ${math.random()}" }',
  'flow "beta" { print "${data.faker.uuid()} ${math.random()}" }',
].join(NEWLINE);

/**
 * `data.*` read a PRNG of this package's own, one per process, which no host
 * could seed and nothing ever reset. A flow's generated values were therefore
 * decided by which flows had run before it: the same flow answered one way in
 * the suite and another under `--flow`, and its README promised the opposite.
 */
describe("the values two flows generate", () => {
  it("are the same when they draw the same things", async () => {
    const [alpha, beta] = await run(TWO_FLOWS);

    expect(beta).toBe(alpha);
  });
});

describe("the values one flow generates", () => {
  it("are the same alone as they are after another flow", async () => {
    const after = (await run(TWO_FLOWS))[1];

    expect((await run(TWO_FLOWS, "beta"))[0]).toBe(after);
  });

  it("are the same in a second run of the same seed", async () => {
    expect(await run(TWO_FLOWS)).toEqual(await run(TWO_FLOWS));
  });
});

/**
 * The mock state is deliberately not reset per flow. It was, briefly, and it
 * threw away what `setup` had arranged: `setup` runs once before every flow, so
 * a per-flow reset left every flow after the first running against no
 * interceptors and no flags. Issue #276 is about the generated values, which a
 * flow does restart. What a suite arranges, a suite owns, and that is the line.
 */
