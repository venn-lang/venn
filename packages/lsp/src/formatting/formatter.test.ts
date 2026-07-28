import { parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { applyEdits, fixture } from "../testing/lsp-fixture.js";

const MESSY = `flow "F" {
step "s" {
expect true
}
}`;

const INLINE = `flow "F" {
  step "s" { expect true }
}`;

async function format(source: string): Promise<string> {
  const { services, document, uri } = await fixture(source);
  const edits = await services.lsp.Formatter?.formatDocument(document, {
    textDocument: { uri },
    options: { tabSize: 2, insertSpaces: true },
  });
  return applyEdits(document, edits ?? []);
}

describe("formatter", () => {
  it("indents nested blocks, stays idempotent, and keeps the file parseable", async () => {
    const once = await format(MESSY);
    const twice = await format(once);

    expect(once).toContain("  step");
    expect(once).toContain("    expect true");
    expect(twice).toBe(once);
    expect(parse(once).problems).toEqual([]);
  });

  it("leaves a one-line block exactly as written", async () => {
    expect(await format(INLINE)).toBe(INLINE);
  });
});
