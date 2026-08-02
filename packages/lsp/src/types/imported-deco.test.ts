import { describe, expect, it } from "vitest";
import { fixture } from "../testing/lsp-fixture.js";

const LIB = `pub deco inject(target: Fn, name: string) { target.addParam(name) }
pub deco off(target: Flow) { target.meta "skip" true }`;

/** Every diagnostic the editor would draw on this file. */
async function diagnostics(source: string): Promise<string[]> {
  const { document } = await fixture(source, { "lib.vn": LIB });
  return (document.diagnostics ?? []).map((one) => String(one.message));
}

/**
 * The editor reads the file the author is looking at, and that file's imports
 * are part of it.
 *
 * A `deco` from another file has to be read, or the checker draws red under
 * every call to a function that decorator reshapes (a program that runs, marked
 * wrong as it is typed) and says nothing where it is genuinely misapplied.
 */
describe("an imported deco, in the editor", () => {
  it("draws nothing on a function the imported decorator reshapes", async () => {
    const source = [
      'import { inject } from "./lib.vn"',
      '@inject("who")',
      "fn greet(g) => g",
      'const r = greet("a", "b")',
    ].join("\n");

    expect(await diagnostics(source)).toEqual([]);
  });

  it("draws the wrong-kind refusal, in the words the signature used", async () => {
    const source = ['import { off } from "./lib.vn"', "@off", "fn f(n) => n"].join("\n");

    expect(await diagnostics(source)).toEqual(["@off decorates a flow, and this is a function."]);
  });

  it("still draws on a call the decorator does not excuse", async () => {
    const source = [
      'import { inject } from "./lib.vn"',
      '@inject("who")',
      "fn greet(g) => g",
      "fn plain(g) => g",
      'const r = plain("a", "b")',
    ].join("\n");

    expect(await diagnostics(source)).toEqual([
      "Type mismatch: expected fn(string, string) -> a, found fn(a) -> a.",
    ]);
  });
});
