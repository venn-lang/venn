import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const run = promisify(execFile);
const MOVED = join(import.meta.dirname, "moved.ts");

/**
 * Run as a process, because what matters is what a person sees and what a shell
 * gets back, and the file ends in `process.exit`.
 */
async function moved(): Promise<{ code: number; said: string }> {
  try {
    const { stderr } = await run(process.execPath, [MOVED]);
    return { code: 0, said: stderr };
  } catch (error) {
    const failed = error as { code?: number; stderr?: string };
    return { code: failed.code ?? -1, said: failed.stderr ?? "" };
  }
}

describe("what `venn` is on this package now", () => {
  /**
   * Somebody on 0.1.3, where this package was the command, upgrades. Without
   * this they land on `venn: command not found`, with a working compiler on
   * disk and nothing on the PATH to reach it with.
   */
  it("names the package that has the command", async () => {
    const { said } = await moved();

    expect(said).toContain("npm i -g @venn-lang/venn");
  });

  /**
   * Both packages want the name `venn`, and npm refuses to take one another
   * package holds: installing before removing fails with EEXIST, which is the
   * wall this message exists to keep somebody off.
   */
  it("says to remove this one first, in that order", async () => {
    const { said } = await moved();

    const remove = said.indexOf("npm rm -g @venn-lang/cli");
    const install = said.indexOf("npm i -g @venn-lang/venn");
    expect(remove).toBeGreaterThan(-1);
    expect(remove).toBeLessThan(install);
    expect(said).toContain("EEXIST");
  });

  /** A shell, a script or CI reads this, and nothing was done. */
  it("leaves with a failure", async () => {
    expect((await moved()).code).toBe(1);
  });

  /**
   * On stderr, so a script that captured the output of the old `venn` does not
   * silently take a paragraph of English for the data it was expecting.
   */
  it("says it on standard error, and prints nothing on standard out", async () => {
    const { stdout } = await run(process.execPath, [MOVED]).catch(
      (error) => error as { stdout: string },
    );

    expect(stdout).toBe("");
  });
});
