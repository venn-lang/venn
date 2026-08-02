import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const run = promisify(execFile);

/** Files git knows about, which is what the charter is a rule about. */
async function tracked() {
  const { stdout } = await run("git", ["ls-files"], { maxBuffer: 1 << 24 });
  return stdout.split("\n").filter(Boolean);
}

/** Anything that is not text, and a lockfile nobody writes by hand. */
const NOT_PROSE = /\.(png|jpg|jpeg|gif|ico|woff2?|lock)$/;

/**
 * Built from the code points rather than written out, so this file is not the
 * one thing it forbids. Written out, the guard fails on itself the moment git
 * starts tracking it, which is a test that can only pass while it is new.
 */
const DASHES = new RegExp(`[${String.fromCharCode(0x2014, 0x2013)}]`);

/**
 * No em dash, and no en dash, anywhere git can see.
 *
 * The rule is the charter's and it is about writing rather than about
 * characters: a sentence that wants one wants a comma, a colon, a bracket or a
 * full stop, and choosing which is the part that makes the sentence better. It
 * is here because a rule nobody checks is a rule that comes back, and this one
 * had come back to two hundred and seventy-four places across sixty-eight
 * files.
 */
describe("the dash the charter forbids", () => {
  it("is in no file git tracks", async () => {
    const found = [];
    for (const path of await tracked()) {
      if (NOT_PROSE.test(path)) continue;
      const text = await readFile(path, "utf8").catch(() => "");
      if (DASHES.test(text)) found.push(path);
    }

    expect(found).toEqual([]);
  }, 30_000);
});
