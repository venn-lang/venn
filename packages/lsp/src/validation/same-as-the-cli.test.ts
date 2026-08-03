import { describe, expect, it } from "vitest";
import type { Diagnostic } from "vscode-languageserver";
import { fixture } from "../testing/lsp-fixture.js";

async function diagnostics(
  source: string,
  modules: Record<string, string> = {},
): Promise<Diagnostic[]> {
  const { document } = await fixture(source, modules);
  return [...(document.diagnostics ?? [])];
}

/** `1` is Error, `2` Warning, `3` Information, `4` Hint, in the protocol's own order. */
const ERROR = 1;
const HINT = 4;

const NEWLINE = String.fromCharCode(10);
const lines = (...parts: readonly string[]): string => parts.join(NEWLINE);

/**
 * The editor used to see a narrower language than the CLI, in five directions
 * at once, because it assembled its own analysis rather than reusing the one
 * `venn check` runs. It calls the shared front end now, and these are the
 * differences that closing that gap was for.
 */
describe("what the editor reports", () => {
  /**
   * The validator built a registry and passed it to one pass and not the other,
   * so the note that tells you what to write instead, which is the most useful
   * thing the check produces, never reached the one surface people read.
   */
  it("names a verb an import asked for as though it were a value", async () => {
    const found = await diagnostics(lines('import { get } from "venn/http"', "print get"));
    const said = found.find((one) => one.code === "VN2009");

    expect(said?.message).toContain("does not publish get");
    expect(said?.message).toContain("import `{ http }` and write `http.get`");
  });

  /**
   * `VN5005` is declared a hint because an import nobody used is untidy rather
   * than wrong, and `venn check` exits 0 on it. Every diagnostic used to arrive
   * as an Error, so the editor was red where CI was green.
   */
  it("keeps the severity the catalogue declared", async () => {
    const found = await diagnostics(lines('import { json } from "venn/json"', 'print "hi"'));

    expect(found.map((one) => [one.code, one.severity])).toEqual([["VN5005", HINT]]);
  });

  it("still reports a name resolution failure as an error", async () => {
    const found = await diagnostics(lines('flow "F" {', '  step "s" { nope.doThing }', "}"));

    expect(found.map((one) => one.severity)).toEqual([ERROR]);
  });

  /** The span and the label a client renders as a jump to the other declaration. */
  it("carries the other place a problem is about", async () => {
    const found = await diagnostics(lines("const thing = 1", "const thing = 2", 'print "x"'));
    const said = found.find((one) => one.code === "VN2020");

    expect(said?.relatedInformation?.[0]?.message).toContain("bound here");
  });

  /**
   * The type pass composed only half of what a package publishes: the derived
   * half, read from `target/`, and not the values a plugin publishes in code.
   */
  it("types a value a plugin publishes", async () => {
    const found = await diagnostics(lines('import { pi } from "venn/math"', "print pi.upper"));

    expect(found.map((one) => one.code)).toContain("VN3010");
  });

  /** The position, which was the wrapper's rather than the file's. */
  it("puts an error inside a placeholder on the placeholder", async () => {
    const found = await diagnostics(lines("const xs = [1, 2, 3]", 'print "n=${xs.length}"'));
    const said = found.find((one) => one.code === "VN3010");

    expect(said?.range.start).toEqual({ line: 1, character: 11 });
  });
});
