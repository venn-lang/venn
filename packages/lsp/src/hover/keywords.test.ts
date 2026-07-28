import { describe, expect, it } from "vitest";
import { isKeyword, keywordHover } from "./keywords.js";

// Every word the fixed grammar defines. If the kernel grows a keyword, this list
// fails until it is documented: the table is the language's own reference.
const KERNEL = [
  "module",
  "use",
  "import",
  "from",
  "as",
  "pub",
  "flow",
  "step",
  "group",
  "fragment",
  "fn",
  "deco",
  "run",
  "expect",
  "not",
  "all",
  "soft",
  "let",
  "const",
  "capture",
  "resource",
  "config",
  "matrix",
  "dataset",
  "factory",
  "type",
  "report",
  "if",
  "else",
  "forEach",
  "in",
  "repeat",
  "while",
  "parallel",
  "race",
  "try",
  "catch",
  "finally",
  "defer",
  "setup",
  "teardown",
  "beforeEach",
  "afterEach",
  "on",
  "return",
  "break",
  "continue",
  "true",
  "false",
  "null",
];

describe("keyword documentation", () => {
  it("documents every keyword of the kernel", () => {
    const undocumented = KERNEL.filter((word) => !isKeyword(word));

    expect(undocumented).toEqual([]);
  });

  it("renders a signature and a summary for each", () => {
    for (const word of KERNEL) {
      const markdown = keywordHover(word) ?? "";
      expect(markdown, word).toContain(`\`\`\`venn\n${word}\n\`\`\``);
      expect(markdown.length, word).toBeGreaterThan(word.length + 20);
    }
  });

  it("shows a runnable example for the words that need one", () => {
    expect(keywordHover("forEach")).toContain("**Example**");
    expect(keywordHover("race")).toContain("timeout: 10s");
    expect(keywordHover("defer")).toContain("ROLLBACK");
  });

  it("says nothing about a word it does not define", () => {
    expect(keywordHover("banana")).toBeUndefined();
    expect(isKeyword("banana")).toBe(false);
  });
});

describe("built-in names that are not keywords", () => {
  it("explains `env`, which the grammar treats as an ordinary name", () => {
    const markdown = keywordHover("env") ?? "";

    expect(markdown).toContain("venn.toml");
    expect(markdown).toContain("--env");
    expect(markdown).toContain("**Example**");
    expect(markdown).toContain('use "venn/env"');
  });

  it("tells anyone still writing `capture` what replaced it", () => {
    expect(keywordHover("capture")).toContain("`let`");
  });
});
