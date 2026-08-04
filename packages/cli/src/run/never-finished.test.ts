import { afterEach, describe, expect, it } from "vitest";
import { watchForAStuckRun } from "./never-finished.js";

const was = process.exitCode;

afterEach(() => {
  process.exitCode = was;
});

/** Run the watch, telling it whether the command reported before the loop drained. */
function drained(reportedFirst: boolean): string[] {
  const said: string[] = [];
  const settled = watchForAStuckRun((line) => said.push(line));
  if (reportedFirst) settled();
  process.emit("beforeExit", 0);
  settled();
  return said;
}

describe("a run that never reached a verdict", () => {
  it("says so and leaves with a code, rather than draining quietly", () => {
    const said = drained(false);

    expect(said[0]).toContain("never finished");
    expect(process.exitCode).toBe(70);
  });

  it("says nothing once the command has reported", () => {
    const said = drained(true);

    expect(said).toEqual([]);
    expect(process.exitCode).toBe(was);
  });
});
