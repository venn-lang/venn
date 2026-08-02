import { ConsolePort, createMemoryConsole, createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/create-runner.js";

const NEWLINE = String.fromCharCode(10);

async function run(source: string): Promise<string[]> {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  const console = createMemoryConsole();
  const runner = createRunner({
    host: createTestHost(),
    plugins: [],
    sink: createMemorySink(),
    ports: [{ port: ConsolePort, impl: console }],
  });
  await runner.script(ast);
  return console.out.split(NEWLINE).filter((line) => line !== "");
}

/**
 * The same value, printed and interpolated, on two lines of one program.
 *
 * Written as a comparison rather than as an expected string, because what is
 * being held is that the two agree. A test that named the text would go green on
 * the day they both changed to the same wrong thing.
 *
 * The value is bound to a name first rather than written into the placeholder,
 * because a map literal inside `${…}` does not scan (#242). That is a separate
 * hole and naming the value keeps this test about the one thing it is about.
 */
async function bothWays(expression: string): Promise<{ printed: string; interpolated: string }> {
  const [printed, interpolated] = await run(
    [`const it = ${expression}`, "print it", 'print "${it}"'].join(NEWLINE),
  );
  return { printed: printed as string, interpolated: interpolated as string };
}

/**
 * `print x` and `"${x}"` are one definition.
 *
 * They were two, and the one `print` used answered with the interpreter's own
 * shape: `{"kind":"duration","ms":300}` for `300ms`, JSON for every map. It is
 * the first thing anybody does with a value they are working out, so of the two
 * it was the one more likely to be seen, and whichever a reader met first the
 * other one taught them the language does not know its own mind.
 */
describe("printing a value and interpolating it", () => {
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
      const { printed, interpolated } = await bothWays(expression);

      expect(printed).toBe(interpolated);
    });
  }

  /**
   * The one place they differ, and it is on purpose. `print x` asked what `x` is
   * and deserves an answer; an interpolation is a sentence with a gap in it, and
   * `add ${name}` with no name reads better as `add ` than as `add null`.
   */
  it("part company over nothing, which is the one rule that differs", async () => {
    const lines = await run(["const it = null", "print it", 'print "[${it}]"'].join(NEWLINE));

    expect(lines).toEqual(["null", "[]"]);
  });

  it("never lets the host's words out", async () => {
    const lines = await run(
      ["const one = { a: 1 }", "print one", "print [1]", "print 300ms", "print str(one)"].join(
        NEWLINE,
      ),
    );

    expect(lines.join(" ")).not.toContain("object Object");
    expect(lines.join(" ")).not.toContain('"kind"');
  });
});
