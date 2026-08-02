import { createTestHost } from "@venn-lang/contracts";
import { createFakeClient } from "@venn-lang/http";
import { createMemorySink } from "@venn-lang/runtime";
import { describe, expect, it } from "vitest";
import { runFile } from "./run-file.js";

const NEWLINE = String.fromCharCode(10);

async function refusals(...lines: readonly string[]) {
  const outcome = await runFile({
    source: lines.join(NEWLINE),
    uri: "memory://lint.vn",
    host: createTestHost(),
    sink: createMemorySink(),
    httpClient: createFakeClient({ responses: {} }),
    mode: "script",
  });
  return outcome;
}

/**
 * A lint that only `venn check` reads is a lint nobody reads.
 *
 * The document check ran under `venn check` and in the editor and not here, so
 * `print { a: 1 }` was refused by one command and printed an empty line under
 * the other. A run already stops for a parse error and for an import that names
 * nothing; a lint error is the same thing said later.
 */
describe("a lint error stops a run", () => {
  it("refuses a value a verb swallowed as its options, and never runs", async () => {
    const outcome = await refusals("print { a: 1 }");

    expect(outcome.problems.map((one) => one.code)).toEqual(["VN5007"]);
    expect(outcome.result).toBeUndefined();
  });

  it("refuses concurrency asked for in a pure body", async () => {
    const outcome = await refusals(
      "fn total(xs) {",
      "  let sum = 0",
      "  forEach x in xs { concurrency: 4 } {",
      "    sum = sum + x",
      "  }",
      "  return sum",
      "}",
      "print total([1])",
    );

    expect(outcome.problems.map((one) => one.code)).toEqual(["VN5008"]);
    expect(outcome.result).toBeUndefined();
  });

  /**
   * A hint is untidiness rather than a mistake, and a run that stopped for one,
   * or even mentioned one, would teach people to stop reading them.
   */
  it("runs anyway when the only thing found is a hint", async () => {
    const outcome = await refusals('import { equals } from "venn/assert"', 'print "ran"');

    expect(outcome.problems.map((one) => one.code)).toEqual([]);
    expect(outcome.result).toBeDefined();
  });

  it("declares the environment it was given, so a name in it is not unknown", async () => {
    const outcome = await runFile({
      source: 'print "ran"',
      uri: "memory://lint.vn",
      host: createTestHost(),
      sink: createMemorySink(),
      httpClient: createFakeClient({ responses: {} }),
      env: { BASE: "http://x" },
      mode: "script",
    });

    expect(outcome.problems).toEqual([]);
  });
});
