import { describe, expect, it } from "vitest";
import { fixture } from "../testing/lsp-fixture.js";

async function codes(source: string): Promise<Array<string | number | undefined>> {
  const { document } = await fixture(source);
  return (document.diagnostics ?? []).map((diagnostic) => diagnostic.code);
}

describe("diagnostics", () => {
  it("reports an unknown action, matcher and fragment with their VN codes", async () => {
    const found = await codes(`flow "F" {
  step "s" {
    nope.doThing
    expect 1 nonsense
    run ghost()
  }
}`);

    expect(found).toContain("VN2003");
    expect(found).toContain("VN2004");
    expect(found).toContain("VN2005");
  });

  it("stays silent on a document whose references all resolve", async () => {
    const found = await codes(`import { http } from "venn/http"

flow "F" {
  step "s" {
    const res = http.get "https://example.com"
    expect res.status == 200
  }
}`);

    expect(found).toEqual([]);
  });
});

/**
 * The link is derived once, where the `Problem` is made, and the comment there
 * says it gives the terminal, the editor and a program's `catch` the same URL.
 * Two of those three read it; nothing in this package mentioned
 * `codeDescription`, which is the field the protocol has for exactly this and
 * which a client renders as a clickable code.
 */
describe("the page behind a diagnostic's code", () => {
  it("is published for a problem the checker found", async () => {
    const { document } = await fixture('flow "F" {\n  step "s" {\n    nope.doThing\n  }\n}');
    const found = (document.diagnostics ?? []).find((one) => one.code === "VN2003");

    expect(found?.codeDescription).toEqual({ href: "https://venn.dev/e/VN2003" });
  });

  it("is published for a problem the parser refused on", async () => {
    const { document } = await fixture('flow "F" {\n  step "s" {\n');
    const found = (document.diagnostics ?? []).filter((one) => one.codeDescription);

    expect(found.length).toBeGreaterThan(0);
    expect(found[0]?.codeDescription?.href).toBe(`https://venn.dev/e/${found[0]?.code}`);
  });
});
