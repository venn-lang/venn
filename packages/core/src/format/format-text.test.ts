import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { formatText } from "./format-text.js";

const MESSY = `module demo

use "venn/assert"
import { login } from "#shared/auth.vn"
use "venn/http"

flow "F" {
step "s" {
expect true
}
}`;

describe("formatText", () => {
  it("groups every `use` above every `import`", () => {
    const formatted = formatText(MESSY);

    expect(formatted).toContain('use "venn/assert"\nuse "venn/http"\n');
    expect(formatted.indexOf('use "venn/http"')).toBeLessThan(formatted.indexOf("import {"));
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

    expect(formatted.indexOf("import {")).toBeLessThan(formatted.indexOf('use "venn/http"'));
  });

  it("sorts each group when asked", () => {
    const formatted = formatText('use "venn/http"\nuse "venn/assert"\n\nflow "F" { }', {
      sortHeader: true,
    });

    expect(formatted.indexOf("assert")).toBeLessThan(formatted.indexOf("http"));
  });

  it("keeps a one-line block on one line", () => {
    const inline = 'flow "F" {\n  step "s" { expect true }\n}';

    expect(formatText(inline)).toBe(inline);
  });
});
