import { describe, expect, it } from "vitest";
import type { CodeAction } from "vscode-languageserver";
import { applyEdits, fixture } from "../testing/lsp-fixture.js";

const MISSING_USE = `module demo

use "@venn/assert"

flow "F" {
  step "s" {
    http.get "https://example.com"
    expect true
  }
}`;

async function fixesFor(source: string) {
  const { services, document, uri } = await fixture(source);
  const diagnostics = document.diagnostics ?? [];
  const actions = await services.lsp.CodeActionProvider?.getCodeActions(document, {
    textDocument: { uri },
    range: diagnostics[0]?.range ?? {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
    },
    context: { diagnostics },
  });
  return { document, uri, diagnostics, actions: (actions ?? []) as CodeAction[] };
}

describe("quick fixes", () => {
  it("reports a namespace used without `use`", async () => {
    const { diagnostics } = await fixesFor(MISSING_USE);

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("VN2007");
  });

  it("offers the package that provides the namespace, marked preferred", async () => {
    const { actions } = await fixesFor(MISSING_USE);

    expect(actions.map((action) => action.title)).toEqual(['Add use "@venn/http"']);
    expect(actions[0]?.isPreferred).toBe(true);
  });

  it("inserts the `use` after the ones already there", async () => {
    const { actions, document, uri } = await fixesFor(MISSING_USE);
    const edits = actions[0]?.edit?.changes?.[uri] ?? [];

    const updated = applyEdits(document, edits);
    expect(updated).toContain('use "@venn/assert"\nuse "@venn/http"\n');
  });

  // `use` belongs above `import`, so the anchor is the last `use`, not the last header line.
  it("inserts the `use` above the imports, not after them", async () => {
    const { actions, document, uri } = await fixesFor(`module demo

use "@venn/assert"

import { login } from "./shared/auth.vn"

flow "F" {
  step "s" { http.get "https://example.com" }
}`);
    const edits = actions[0]?.edit?.changes?.[uri] ?? [];

    const updated = applyEdits(document, edits);
    expect(updated.indexOf('use "@venn/http"')).toBeLessThan(updated.indexOf("import {"));
  });

  it("offers nothing for a file whose namespaces are all imported", async () => {
    const { actions, diagnostics } = await fixesFor(`use "@venn/http"

flow "F" {
  step "s" { http.get "https://example.com" }
}`);

    expect(diagnostics).toEqual([]);
    expect(actions).toEqual([]);
  });
});

describe("quick fix for env inside a string", () => {
  const ENV_IN_STRING = `flow "F" {
  step "s" {
    let url = "\${env.BASE_URL}/health"
    expect true
  }
}`;

  it('offers `use "@venn/env"` for an env read hidden in a placeholder', async () => {
    const { actions } = await fixesFor(ENV_IN_STRING);

    expect(actions.map((action) => action.title)).toContain('Add use "@venn/env"');
  });
});
