import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scriptCommand } from "./script.js";

const FAILS = `module demo.crash
import { assert } from "venn/assert"

expect 1 == 2
`;

const THROWS = `const s = { a: 1 }
s.nope()
`;

let root = "";

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "venn-run-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

/** What `venn run` said on stderr, and the code it left with. */
async function run(source: string): Promise<{ said: string; code: number }> {
  const file = join(root, "crash.vn");
  await writeFile(file, source, "utf8");
  const chunks: string[] = [];
  const spy = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    chunks.push(String(chunk));
    return true;
  });
  try {
    const ending = await scriptCommand({ file });
    return { said: chunks.join(""), code: ending.code };
  } finally {
    spy.mockRestore();
  }
}

/**
 * A failure a program raised, as a person reading a terminal sees it.
 *
 * Every `new ProblemError` in the kernel and the runtime lost its code and its
 * location here: a `ProblemError` is not a `VennError`, so the one line the CLI
 * printed came off `.message`, which is the title alone. The problem was built
 * complete and dropped at the last moment.
 */
describe("what `venn run` says when a program fails", () => {
  it("prints the code and where it happened, not the title alone", async () => {
    const { said, code } = await run(FAILS);

    expect(said).toContain("VN6001");
    expect(said).toContain("crash.vn:4:1");
    expect(code).toBe(1);
  });

  /**
   * The raise site reported it and the sink said it out loud, so the catch at
   * the top is not a second voice: one failure, said once.
   *
   * Counted by the headline rather than by the bare code, because one report
   * now names its code twice on purpose: once at the top, and once inside the
   * `docs` line that says where to read more about it.
   */
  it("says one failure once", async () => {
    const { said } = await run(FAILS);

    expect(said.match(/VN6001 ·/g)).toHaveLength(1);
    expect(said).toContain("docs  https://venn.dev/e/VN6001");
  });

  /**
   * `VennError` carries most of the runtime's codes, and this one arrived as
   * `VN2003  Unknown action "s.nope".`: no location, no help, and a separator of
   * its own beside the `VN3010 · title` a `ProblemError` prints, so one command's
   * stderr carried two formats for one kind of failure.
   */
  it("says a thrown code where it happened, in the one format", async () => {
    const { said, code } = await run(THROWS);

    expect(said).toContain('VN2003 · Unknown action "s.nope".');
    expect(said).toContain("crash.vn:2:1");
    expect(code).toBe(1);
  });
});
