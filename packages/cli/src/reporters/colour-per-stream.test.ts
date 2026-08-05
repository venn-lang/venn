import type { Problem } from "@venn-lang/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dim } from "./colors.js";
import { problemDetail } from "./problem-detail.js";
import { reportProblems } from "./problem-reporter.js";

const ESC = String.fromCharCode(27);

const PROBLEM: Problem = {
  code: "VN1002",
  severity: "error",
  title: "Expected a name here, found `in`.",
  span: { uri: "p4.vn", offset: 4, length: 2, line: 1, column: 5 },
};

const was = { stdout: process.stdout.isTTY, stderr: process.stderr.isTTY };

beforeEach(() => {
  vi.stubEnv("NO_COLOR", "");
  vi.stubEnv("TERM", "xterm-256color");
});

afterEach(() => {
  vi.unstubAllEnvs();
  process.stdout.isTTY = was.stdout;
  process.stderr.isTTY = was.stderr;
});

/** What `reportProblems` wrote, with each stream told what it is. */
function reported(streams: { stdout: boolean; stderr: boolean }): string {
  const chunks: string[] = [];
  const spy = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    chunks.push(String(chunk));
    return true;
  });
  process.stdout.isTTY = streams.stdout;
  process.stderr.isTTY = streams.stderr;
  try {
    reportProblems([PROBLEM]);
    return chunks.join("");
  } finally {
    spy.mockRestore();
  }
}

/**
 * Colour is a question about one stream, and it was answered once at import
 * from standard output alone. Problems go to standard error, so `2>err.txt`
 * with a terminal still attached wrote escape codes into the file: `^[[2mat`
 * where the file wanted `at`.
 */
describe("colour on a stream of its own", () => {
  it("writes a redirected stderr plain while stdout is still a terminal", () => {
    expect(reported({ stdout: true, stderr: false })).not.toContain(ESC);
  });

  it("colours stderr when that is the terminal", () => {
    expect(reported({ stdout: false, stderr: true })).toContain(ESC);
  });

  it("keeps the report coloured for a terminal stdout", () => {
    process.stdout.isTTY = true;

    expect(problemDetail(PROBLEM).join("")).toContain(ESC);
  });

  /**
   * Asked per call, not once at import, which is the half of the defect that
   * kept it uncovered: nothing could change the answer after the module loaded.
   */
  it("obeys NO_COLOR set after the module was loaded", () => {
    vi.stubEnv("NO_COLOR", "1");
    process.stdout.isTTY = true;

    expect(dim("at")).toBe("at");
    expect(reported({ stdout: true, stderr: true })).not.toContain(ESC);
  });
});
