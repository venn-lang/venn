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
