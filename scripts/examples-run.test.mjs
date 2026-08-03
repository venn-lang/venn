import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { commandFor, committed, everyExample } from "./examples-run.mjs";
import { ROOT } from "./repo-sources.mjs";

const README = join(ROOT, "examples", "README.md");

/**
 * The half of the examples guard that needs nothing built.
 *
 * Driving the shipped binary needs `packages/cli/dist`, and `pnpm test` runs
 * from `src` on a fresh clone with nothing built, which the charter states as a
 * property of the suite. So the spawning half is a CI step after Build, and
 * what runs here is the comparison that makes forgetting it impossible: an
 * example added without a regeneration has no expectation, and this says so
 * before anybody waits for CI.
 */
describe("the examples the binary is held to", () => {
  it("are exactly the ones on disk", async () => {
    const expected = await committed();
    const disk = await everyExample();

    expect(disk.filter((path) => !expected[path])).toEqual([]);
    expect(Object.keys(expected).filter((path) => !disk.includes(path))).toEqual([]);
  });

  it("are each recorded with the command the file asks for", async () => {
    const expected = await committed();
    const wrong = [];
    for (const [path, entry] of Object.entries(expected)) {
      const wants = await commandFor(path);
      if (entry.command !== wants)
        wrong.push(`${path}: recorded under ${entry.command}, and it is a ${wants}`);
    }

    expect(wrong).toEqual([]);
  });

  it("are each recorded with an exit status and both streams", async () => {
    const thin = [];
    for (const [path, entry] of Object.entries(await committed())) {
      if (typeof entry.exit !== "number") thin.push(`${path}: no exit status recorded`);
      if (typeof entry.stdout !== "string") thin.push(`${path}: no stdout recorded`);
      if (typeof entry.stderr !== "string") thin.push(`${path}: no stderr recorded`);
    }

    expect(thin).toEqual([]);
  });

  /**
   * The counts are the assertion exit status cannot make. `venn test` on a file
   * with no flows prints `0 passed, 0 failed` and exits 0, so a regression that
   * stopped flows being found looks exactly like success.
   */
  it("record what every test file passed, and that none of it failed", async () => {
    const wrong = [];
    for (const [path, entry] of Object.entries(await committed())) {
      if (entry.command !== "test") continue;
      if (!(entry.passed > 0))
        wrong.push(`${path}: ${entry.passed} passed, which is a test file that tests nothing`);
      if (entry.failed !== 0) wrong.push(`${path}: ${entry.failed} failed`);
    }

    expect(wrong).toEqual([]);
  });

  /** A number in prose that nothing recomputes is a number that goes stale. */
  it("are counted correctly by the README that introduces them", async () => {
    const text = await readFile(README, "utf8");
    const said = /type-check all (\d+) at once/.exec(text);
    const disk = await everyExample();

    expect(said?.[1]).toBe(String(disk.length));
  });
});
