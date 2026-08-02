import {
  ConsolePort,
  createMemoryConsole,
  createTestHost,
  type Host,
  type MemoryLogger,
} from "@venn-lang/contracts";
import { type Problem, parse } from "@venn-lang/core";
import { defineMatcher, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink, type MemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/create-runner.js";

const NEWLINE = String.fromCharCode(10);

/** Two matchers that always fail, so that what a failure carries can be read. */
const showPlugin = definePlugin({
  name: "@t/show",
  version: "0",
  namespace: "t",
  matchers: [
    // Titles the failure with nothing but `ctx.show`.
    defineMatcher({
      name: "shows",
      test: () => false,
      message: ({ subject }, ctx) => ctx.show(subject),
    }),
    defineMatcher({
      name: "notes",
      test: () => false,
      message: ({ subject }, ctx) => {
        ctx.log(`looked at ${ctx.show(subject)}`);
        return "noted";
      },
    }),
  ],
});

function titleOf(sink: MemorySink): string {
  const event = sink.envelopes.find((envelope) => envelope.kind === "expect.failed");
  if (!event) throw new Error("no expect.failed event");
  return (event.data as { problem: Problem }).problem.title;
}

async function run(source: string): Promise<{ out: string; sink: MemorySink; host: Host }> {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  const memory = createMemoryConsole();
  const sink = createMemorySink();
  const host = createTestHost();
  const ports = [{ port: ConsolePort, impl: memory }];
  await createRunner({ host, plugins: [showPlugin], sink, ports }).run(ast);
  return { out: memory.out, sink, host };
}

function program(args: { expression: string; matcher: string }): string {
  return [
    'flow "F" {',
    '  step "s" {',
    `    let it = ${args.expression}`,
    "    print it",
    `    expect it ${args.matcher}`,
    "  }",
    "}",
  ].join(NEWLINE);
}

/**
 * One value, printed and then failed against, in one step of one program.
 *
 * A comparison rather than an expected string, because what is being held is
 * that the two agree. A test that named the text would go green on the day they
 * both changed to the same wrong thing.
 */
async function bothWays(expression: string): Promise<{ printed: string; titled: string }> {
  const { out, sink } = await run(program({ expression, matcher: "shows" }));
  return { printed: out.split(NEWLINE)[0] as string, titled: titleOf(sink) };
}

/**
 * A failing check and a `print` are one definition.
 *
 * They were two. A matcher is handed a `MatcherContext`, which carried only
 * `log`, so a plugin with a failure to word had no way to reach the language's
 * renderer and wrote one of its own. The failure title is the worst place for a
 * second answer, because it is read by somebody who already does not understand
 * what happened.
 */
describe("failing a check and printing the value", () => {
  const CASES = [
    '{ hits: 0, name: "ada" }',
    "{}",
    '{ user: { name: "ada", tags: ["a", "b"] } }',
    "[1, 2]",
    "[]",
    "[{ id: 1 }, { id: 2 }]",
    '[1, null, "two"]',
    "300ms",
    "2048b",
    "true",
    "42",
    '"a plain string"',
  ];

  for (const expression of CASES) {
    it(`agree about ${expression}`, async () => {
      const { printed, titled } = await bothWays(expression);

      expect(titled).toBe(printed);
    });
  }

  it("never lets the host's words into a failure title", async () => {
    const { titled } = await bothWays('{ at: 300ms, tags: ["a"] }');

    expect(titled).not.toContain("object Object");
    expect(titled).not.toContain('"kind"');
  });

  it("hands the same context a way into the host log", async () => {
    const { host, out } = await run(program({ expression: "[1, 2]", matcher: "notes" }));

    const logger = host.log as MemoryLogger;
    expect(logger.entries.map((entry) => entry.message)).toContain(
      `looked at ${out.split(NEWLINE)[0]}`,
    );
  });
});
