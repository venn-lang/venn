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

  it("leaves a real syntax error as one, whatever the word is called", () => {
    const said = parse('flow "x" constructor').problems[0];

    expect(said?.code).toBe("VN1002");
    expect(said?.title).toBe("Expected an opening brace here, found `constructor`.");
  });

  /** A name somebody bound is a name, wherever the word came from. */
  it("says nothing about a removed word used as something else", () => {
    expect(parse("const m = { a: 1 }\nprint m.while").problems).toEqual([]);
  });
});

describe("what the removals left alone", () => {
  /** The two spellings that do work, so the removal took nothing else with it. */
  it("still takes the imports that publish by name", () => {
    const source = 'import { total } from "./cart.vn"\nimport * as cart from "./cart.vn"';

    expect(parse(source).problems).toEqual([]);
  });
});
