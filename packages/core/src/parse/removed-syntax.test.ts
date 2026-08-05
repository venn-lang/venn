import { describe, expect, it } from "vitest";
import { parse } from "./parse.js";

const NEWLINE = String.fromCharCode(10);

/**
 * Syntax that parsed and did nothing, now gone.
 *
 * Each of these was a rule the grammar accepted, the checker passed and no
 * runtime read, so the name it bound was absent and whatever used it failed
 * somewhere else. What this holds is that they stay out: a rule that comes back
 * without a runtime behind it is the same bug again.
 */
const REMOVED = [
  { name: "factory", source: "factory User {\n  email: 1\n}" },
  { name: "dataset", source: 'dataset clients = ["a"]' },
  { name: "report", source: 'report "junit"' },
];

describe("syntax that was removed", () => {
  for (const removed of REMOVED) {
    it(`does not silently accept ${removed.name}`, () => {
      const { ast, problems } = parse(removed.source);

      // Either it fails to parse, or it parses as something else entirely (an
      // action call nobody provides). What it must never do is parse into a
      // declaration of its own, which is what left the name unbound.
      const declared = ast.decls.map((decl) => decl.$type);
      expect(declared).not.toContain("FactoryDecl");
      expect(declared).not.toContain("DatasetDecl");
      expect(declared).not.toContain("ReportDecl");
      expect(problems.length > 0 || declared.every((kind) => kind === "ActionCall")).toBe(true);
    });
  }
});

/**
 * Two words that were removed and are still written, so what they get is a
 * sentence rather than the parser's own words about a token it did not expect.
 */
describe("a word the language used to have", () => {
  it("says what became of `while`, wherever it is written", () => {
    const found = parse(["while true {", "  break", "}"].join(NEWLINE)).problems[0];

    expect(found?.code).toBe("VN5001");
    expect(found?.title).toContain("`loop` while the condition holds");
  });

  it("says the same inside a flow", () => {
    const source = [
      'flow "F" {',
      '  step "s" {',
      "    while true {",
      "      break",
      "    }",
      "  }",
      "}",
    ].join(NEWLINE);

    expect(parse(source).problems[0]?.code).toBe("VN5001");
  });

  /**
   * `capture` keeps its rule, so it parses and reaches its own check. It was
   * only in the statement list, which made it a parse error at the top of a
   * file, where a program has its bindings.
   */
  it("takes `capture` at the top of a file, to refuse it properly", () => {
    expect(parse("capture x = 1").problems).toEqual([]);
  });

  /** The word itself, not wherever error recovery happened to come to rest. */
  it("points at the word, not at the statement the parser gave up on", () => {
    const found = parse('flow "F" {\n  step "s" {\n    while true {\n      break\n    }\n  }\n}')
      .problems[0];

    expect(found?.span.line).toBe(3);
    expect(found?.span.column).toBe(5);
  });

  /**
   * The table was an object literal, so `REMOVED[word]` answered for every
   * member of `Object.prototype` as well, and what came back was a function or
   * an object where a title is typed `string`. `flow "x" constructor` reported
   * `VN5001 . function Object() { [native code] }`, and a real syntax error was
   * replaced by a lint-family one.
   */
  it("says nothing about a word that is only a member of Object.prototype", () => {
    for (const word of Object.getOwnPropertyNames(Object.prototype)) {
      const found = parse(`${word} true {${NEWLINE}  print 1${NEWLINE}}`).problems;

      expect(
        found.map((problem) => problem.code),
        word,
      ).not.toContain("VN5001");
      for (const problem of found) expect(typeof problem.title, word).toBe("string");
    }
  });

  /**
   * What this holds is that the word is not read as a removed one, not which
   * sentence the parser's own explainers reach for. That sentence has an owner
   * in `separator-words.ts` and pinning it here would make one wording change
   * two files to edit.
   */
  it("leaves a real syntax error as one, whatever the word is called", () => {
    const found = parse('flow "x" constructor').problems;

    expect(found.map((problem) => problem.code)).not.toContain("VN5001");
    expect(found[0]?.code).toBe("VN1002");
    expect(found[0]?.title.length).toBeGreaterThan(0);
  });

  /** A name somebody bound is a name, wherever the word came from. */
  it("says nothing about a removed word used as something else", () => {
    expect(parse("const m = { a: 1 }\nprint m.while").problems).toEqual([]);
  });
});

/**
 * The words a newcomer types for a loop, none of which this language ever had.
 *
 * Each lexes as a name, so the line reads as a call and the parser gets inside
 * the block before it fails. `for r in rows {` earned `An argument is one
 * value, so `in` has to be bracketed`, which named the brackets when the
 * brackets were fine: the first program written in this language paid for that
 * sentence with five hand-rolled counter loops across three files.
 *
 * The `help` is what is asserted, because the help is the part that has to be
 * a spelling that runs. Every one below was run against the built CLI.
 */
const NEVER_HAD: [word: string, opens: string, says: string][] = [
  ["for", "for r in rows {", "`forEach r in rows { print r }`"],
  ["foreach", "foreach r in rows {", "with a capital E"],
  ["each", "each r in rows {", "The word is `forEach`"],
  ["until", "until n > 3 {", "`loop n <= 3 { n = n + 1 }`"],
  ["do", "do {", "`loop { break }`"],
  ["switch", "switch n {", "in a block rather than after a `=>`"],
];

describe("a word this language never had", () => {
  it.each(NEVER_HAD)("names `%s` and says what to write instead", (word, opens, says) => {
    const found = parse(["let n = 0", opens, "  print n", "}"].join(NEWLINE)).problems;

    expect(found.map((problem) => problem.code)).toEqual(["VN5001"]);
    expect(found[0]?.title).toBe(`Venn has no \`${word}\`.`);
    expect(found[0]?.help).toContain(says);
    expect(found[0]?.span.line).toBe(2);
    expect(found[0]?.span.column).toBe(1);
  });
});

/**
 * `while` is the one word that was removed rather than never had, so it keeps
 * the sentence it shipped with, whole and in the title, and a reader who has
 * already googled those words finds the same page.
 */
describe("the word that was removed rather than never had", () => {
  it("leaves `while`'s own sentence exactly where it was", () => {
    const found = parse(["let n = 0", "while n < 3 {", "  n = n + 1", "}"].join(NEWLINE))
      .problems[0];

    expect(found?.title).toBe(
      "`while` was removed, `loop` while the condition holds, `repeat` a known number of times, `forEach` over a collection.",
    );
    expect(found?.help).toBeUndefined();
  });
});

/**
 * A help line is a claim, so what is tested is the repaired program and not the
 * words. Every backticked span carrying a `{` is a program the help promises;
 * anything shorter is a word. Each one was run by hand before it shipped, which
 * the next person to edit the sentence cannot benefit from: this can.
 */
describe("what a help line promises", () => {
  it.each(NEVER_HAD)("hands `%s` a program that parses", (_word, opens) => {
    const source = ["let n = 0", opens, "  print n", "}"].join(NEWLINE);
    const promised = programsIn(parse(source).problems[0]?.help ?? "");

    expect(promised.length).toBeGreaterThan(0);
    for (const snippet of promised) expect(parse(snippet).problems, snippet).toEqual([]);
  });
});

/** The runnable spans of a sentence: backticked, and carrying a block. */
function programsIn(help: string): string[] {
  return [...help.matchAll(/`([^`]*\{[^`]*)`/g)].map((found) => found[1] ?? "");
}

describe("what the removals left alone", () => {
  /** The two spellings that do work, so the removal took nothing else with it. */
  it("still takes the imports that publish by name", () => {
    const source = 'import { total } from "./cart.vn"\nimport * as cart from "./cart.vn"';

    expect(parse(source).problems).toEqual([]);
  });
});
