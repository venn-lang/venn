import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PATH = fileURLToPath(new URL("../package.json", import.meta.url));
const manifest = JSON.parse(readFileSync(PATH, "utf8")) as {
  engines: { vscode: string };
  devDependencies: Record<string, string>;
};

/** `^1.90.0` and `1.90.0` both answer `1.90.0`. */
function floorOf(range: string): string {
  return range.replace(/^[^0-9]*/, "");
}

/**
 * `vsce` refuses to package an extension whose `@types/vscode` is newer than
 * the editor its `engines` claims to support, and `pnpm vscode:install` is the
 * documented way to install this. It was refused for a while:
 *
 *     ERROR  @types/vscode 1.125.0 greater than engines.vscode ^1.90.0.
 *
 * The rule is not arbitrary. The types have to describe the OLDEST editor the
 * extension says it runs on, or it can be written against an API that version
 * does not have and the failure arrives on somebody else's machine. So the two
 * move together, and the direction is to lower the types rather than to raise
 * the engine, unless an API genuinely needs the newer one.
 *
 * Pinned here rather than left to the packaging step, because that step runs
 * only when somebody installs the extension, and by then they are already
 * trying to use it.
 */
describe("what the extension says it needs", () => {
  it("types itself against the oldest editor it claims to support", () => {
    expect(floorOf(manifest.devDependencies["@types/vscode"] as string)).toBe(
      floorOf(manifest.engines.vscode),
    );
  });
});
