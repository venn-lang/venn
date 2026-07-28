import type { RunId } from "@venn-lang/core";
import type { RunResult } from "@venn-lang/runtime";
import { describe, expect, it } from "vitest";
import { exitCodeOf } from "./exit-code.js";

function result(parts: Partial<RunResult>): RunResult {
  return { run: "run-1" as RunId, passed: 0, failed: 0, ...parts };
}

describe("exitCodeOf", () => {
  it("leaves with 0 when nothing failed", () => {
    expect(exitCodeOf(result({ passed: 2 }))).toBe(0);
  });

  // A hook that throws is counted now instead of thrown, so the only thing left
  // between a program whose `setup` blew up and a green CI is this number.
  it("leaves with 1 when the run reported a failure", () => {
    expect(exitCodeOf(result({ failed: 1 }))).toBe(1);
  });

  it("lets the program name its own code, failures or not", () => {
    expect(exitCodeOf(result({ exitCode: 3 }))).toBe(3);
    expect(exitCodeOf(result({ failed: 2, exitCode: 0 }))).toBe(0);
  });

  it("leaves with 0 when there was no run at all", () => {
    expect(exitCodeOf(undefined)).toBe(0);
  });
});
