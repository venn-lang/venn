import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { formatText } from "./format-text.js";

const MESSY = `module demo

import { assert } from "venn/assert"
import { login } from "#shared/auth.vn"
import { http } from "venn/http"

flow "F" {
step "s" {
expect true
}
}`;

describe("formatText", () => {
  it("keeps the imports together at the top", () => {
    const formatted = formatText(MESSY);
    const first = formatted.indexOf("import {");

    expect(first).toBeGreaterThanOrEqual(0);
    expect(formatted.slice(first).split("\n\n")[0]).toContain('from "venn/http"');
  });

  it("re-indents by bracket depth", () => {
    const formatted = formatText(MESSY);

    expect(formatted).toContain('  step "s" {');
    expect(formatted).toContain("    expect true");
  });

  it("is idempotent and keeps the file parseable", () => {
    const once = formatText(MESSY);

    expect(formatText(once)).toBe(once);
    expect(parse(once).problems).toEqual([]);
  });

  it("honours indent width and tabs", () => {
    expect(formatText(MESSY, { indentWidth: 4 })).toContain('    step "s" {');
    expect(formatText(MESSY, { useTabs: true })).toContain('\tstep "s" {');
  });

  it("leaves the header alone when organising is off", () => {
    const formatted = formatText(MESSY, { organizeHeader: false });

    expect(formatted.indexOf("import {")).toBeLessThan(
      formatted.indexOf('import { http } from "venn/http"'),
    );
  });

  it("sorts each group when asked", () => {
    const formatted = formatText(
      'import { http } from "venn/http"\nimport { assert } from "venn/assert"\n\nflow "F" { }',
      {
        sortHeader: true,
      },
    );

    expect(formatted.indexOf("assert")).toBeLessThan(formatted.indexOf("http"));
  });

  it("keeps a one-line block on one line", () => {
    const inline = 'flow "F" {\n  step "s" { expect true }\n}';

    expect(formatText(inline)).toBe(inline);
  });
});
