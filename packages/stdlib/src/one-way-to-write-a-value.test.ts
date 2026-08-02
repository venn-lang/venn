import { ConsolePort, createMemoryConsole, createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { ioPlugin } from "@venn-lang/io";
import { createMemorySink, createRunner } from "@venn-lang/runtime";
import { describe, expect, it } from "vitest";

const NEWLINE = String.fromCharCode(10);

async function run(source: string): Promise<string[]> {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  const console = createMemoryConsole();
  const runner = createRunner({
    host: createTestHost(),
    plugins: [ioPlugin],
    sink: createMemorySink(),
    ports: [{ port: ConsolePort, impl: console }],
  });
  await runner.script(ast);
  return console.out.split(NEWLINE).filter((line) => line !== "");
}

/**
 * The same value written by both spellings, on two lines of one program.
 *
 * A comparison rather than an expected string, because what is being held is
 * that the two agree. A test that named the text would go green on the day they
 * both changed to the same wrong thing.
 */
async function bothWays(expression: string): Promise<{ bare: string; full: string }> {
  const lines = await run([`const it = ${expression}`, "print it", "io.print it"].join(NEWLINE));
  // Two lines or the comparison below has nothing to compare and passes for the
  // wrong reason.
  expect(lines).toHaveLength(2);
  return { bare: lines[0] as string, full: lines[1] as string };
}

/**
 * `print x` and `io.print x` are one definition.
 *
 * They were two: the plugin carried a renderer of its own that answered with
 * JSON, so `print { hits: 0 }` gave `{ hits: 0 }` and `io.print { hits: 0 }`
 * gave `{"hits":0}`, while the verb's own documentation called itself the same
 * verb under its full name. The plugin cannot reach into `core` for the
 * renderer, so the runtime hands it over as `ctx.show`.
 */
describe("printing a value by both of its names", () => {
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
      const { bare, full } = await bothWays(expression);

      expect(full).toBe(bare);
    });
  }

  it("agree about nothing at all, which prints as null either way", async () => {
    const lines = await run(["const it = null", "print it", "io.print it"].join(NEWLINE));

    expect(lines).toEqual(["null", "null"]);
  });

  it("joins several values with a space, as the prelude does", async () => {
    const lines = await run(["print 1 [2] { c: 3 }", "io.print 1 [2] { c: 3 }"].join(NEWLINE));

    expect(lines[1]).toBe(lines[0]);
  });

  it("never lets the host's words out", async () => {
    const lines = await run(
      ["io.print { a: 1 }", "io.print [1]", "io.print 300ms", "io.write { a: 1 }"].join(NEWLINE),
    );

    expect(lines.join(" ")).not.toContain("object Object");
    expect(lines.join(" ")).not.toContain('"kind"');
  });
});
