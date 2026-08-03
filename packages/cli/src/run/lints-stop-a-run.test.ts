import { createMemoryConsole, createTestHost } from "@venn-lang/contracts";
import { createFakeClient } from "@venn-lang/http";
import { createMemorySink } from "@venn-lang/runtime";
import { describe, expect, it } from "vitest";
import { type RunFileArgs, runFile } from "./run-file.js";

const NEWLINE = String.fromCharCode(10);
const lines = (...parts: readonly string[]): string => parts.join(NEWLINE);

/** Every port a snippet needs, the console among them, since these ones print. */
function ports(): Pick<RunFileArgs, "host" | "sink" | "httpClient" | "console" | "mode"> {
  return {
    host: createTestHost(),
    sink: createMemorySink(),
    httpClient: createFakeClient({ responses: {} }),
    console: createMemoryConsole(),
    mode: "script",
  };
}

async function refusals(...lines: readonly string[]) {
  return runFile({ source: lines.join(NEWLINE), uri: "memory://lint.vn", ...ports() });
}

/**
 * A check that only `venn check` reads is a check nobody reads.
 *
 * It happened twice. The document check ran under `venn check` and not here, so
 * `print { a: 1 }` was refused by one command and printed an empty line under
 * the other. That was fixed, and type checking was left behind the same way, so
 * a declared `: number` holding a string ran clean and printed the string. Both
 * because the list of what to check lived in more than one place. There is one
 * front end now, and this is what says so.
 */
describe("a check error stops a run", () => {
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

  /** The pass `venn check` had and this did not, which is the whole of #255. */
  it("refuses a value that is not the type it was declared to be", async () => {
    const outcome = await refusals('const count: number = "seven"', "print count");

    expect(outcome.problems.map((one) => one.code)).toEqual(["VN3010"]);
    expect(outcome.result).toBeUndefined();
  });

  it("refuses a member the type does not have, wherever it is written", async () => {
    const outcome = await refusals("const xs = [1, 2, 3]", 'print "n=${xs.length}"');

    expect(outcome.problems.map((one) => one.code)).toEqual(["VN3010"]);
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

  it("accepts a name the caller said the project declares", async () => {
    const outcome = await runFile({
      source: lines('import { env } from "venn/env"', "print env.BASE"),
      uri: "memory://lint.vn",
      env: { BASE: "http://x" },
      declared: ["BASE"],
      ...ports(),
    });

    expect(outcome.problems).toEqual([]);
  });

  /**
   * Unknown is not empty. A caller that injected an environment has said what a
   * run can read, not what the project declares, and reading the one for the
   * other is how `venn check` and `venn run` came to disagree about a `.env`.
   */
  it("refuses nothing when nobody said what the project declares", async () => {
    const outcome = await runFile({
      source: lines('import { env } from "venn/env"', "print env.ANYTHING"),
      uri: "memory://lint.vn",
      env: { BASE: "http://x" },
      ...ports(),
    });

    expect(outcome.problems).toEqual([]);
  });
});
