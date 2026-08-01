import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkProblems } from "./check.js";

let root = "";

/** A real directory, because this is the walk that reads real files. */
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "venn-check-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function write(name: string, source: string): Promise<string> {
  const path = join(root, name);
  await writeFile(path, source, "utf8");
  return path;
}

async function codes(name: string): Promise<string[]> {
  const found = await checkProblems([join(root, name)]);
  return found.problems.map((problem) => problem.code);
}

/**
 * `venn check` over files on a disk.
 *
 * The walk resolves imports by reading them, so what it finds cannot be shown
 * with a fake file system: whether a path leads anywhere is the question, and a
 * double would be answering it in the test rather than in the code.
 */
describe("checking a file that is really there", () => {
  it("says nothing about a file with nothing wrong", async () => {
    await write("ok.vn", "const total = 1\nprint total\n");

    expect(await codes("ok.vn")).toEqual([]);
  });

  it("reports an import whose path leads nowhere", async () => {
    await write("bad.vn", 'import * as gone from "./gone.vn"\nprint gone\n');

    expect(await codes("bad.vn")).toEqual(["VN2019"]);
  });

  /** The path tried is what the reader needs, and only this walk knows it. */
  it("says which path it tried", async () => {
    await write("bad.vn", 'import * as gone from "./gone.vn"\nprint gone\n');
    const [found] = (await checkProblems([join(root, "bad.vn")])).problems;

    expect(found?.help).toContain("gone.vn");
  });

  it("says nothing when the file it imports is there", async () => {
    await write("lib.vn", "pub const rate = 1\n");
    await write("main.vn", 'import { rate } from "./lib.vn"\nprint rate\n');

    expect(await codes("main.vn")).toEqual([]);
  });

  it("counts the files it walked", async () => {
    await write("a.vn", "print 1\n");
    await write("b.vn", "print 2\n");

    expect((await checkProblems([root])).files).toBe(2);
  });
});
