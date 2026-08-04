import { KEYWORDS } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { documentedWords, isKeyword, keywordHover } from "./keywords.js";

/**
 * The words the table documents that the grammar does not reserve.
 *
 * `env` is an ordinary name the kernel provides rather than a keyword, and it
 * is the one thing here worth hovering that the grammar has never heard of.
 */
const NOT_KEYWORDS = ["env"];

/**
 * The kernel is small enough that this table is the whole language, so the set
 * it documents is derived from the grammar rather than typed out again. There
 * were six hand-written copies of that set and this was a seventh: it still
 * documented `use`, which the language removed, and had never heard of
 * `namespace`, which it gained.
 */
describe("keyword documentation", () => {
  const kernel = [...KEYWORDS];

  it("documents every keyword of the kernel", () => {
    expect(kernel.filter((word) => !isKeyword(word))).toEqual([]);
  });

  it("documents nothing the grammar no longer has", () => {
    const extra = documentedWords().filter((word) => !KEYWORDS.has(word));

    expect(extra.sort()).toEqual([...NOT_KEYWORDS].sort());
  });

  it("renders a signature and a summary for each", () => {
    for (const word of kernel) {
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

  /**
   * The table was looked up with `word in KEYWORDS` on an object literal, so
   * `isKeyword("toString")` was true and hovering it rendered the source of a
   * function off `Object.prototype`.
   */
  it("says nothing about a member of Object.prototype", () => {
    for (const word of Object.getOwnPropertyNames(Object.prototype)) {
      expect(isKeyword(word), word).toBe(false);
      expect(keywordHover(word), word).toBeUndefined();
    }
  });
});

describe("built-in names that are not keywords", () => {
  it("explains `env`, which the grammar treats as an ordinary name", () => {
    const markdown = keywordHover("env") ?? "";

    expect(markdown).toContain("venn.toml");
    expect(markdown).toContain("--env");
    expect(markdown).toContain("**Example**");
    expect(markdown).toContain('import { env } from "venn/env"');
  });

  it("tells anyone still writing `capture` what replaced it", () => {
    expect(keywordHover("capture")).toContain("`let`");
  });
});
