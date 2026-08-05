import { describe, expect, it } from "vitest";
import { parse } from "./index.js";

/** The titles reported for a source, which is what a reader sees. */
function titles(source: string): string[] {
  return parse(source).problems.map((problem) => problem.title);
}

/** Where the first problem points, as a reader's line and column. */
function at(source: string): string {
  const span = parse(source).problems[0]?.span;
  return `${span?.line}:${span?.column}`;
}

const STATEMENTS =
  "A newline or a `;` separates one statement from the next, and there is neither here.";

const ENTRIES = "A newline or a `,` separates one entry from the next, and there is neither here.";

/**
 * Two statements written with nothing between them.
 *
 * The failure is a plain `CONSUME('}')` whose expected set has one member, so
 * twenty-odd different mistakes all read `Expected a closing brace here` and
 * pointed at a brace nobody got wrong.
 */
describe("a statement separator nobody wrote", () => {
  it("names the newline and the semicolon, where a brace used to be blamed", () => {
    expect(titles('flow "F" { step "s" { if true { print 1 } print 2 } }')[0]).toBe(STATEMENTS);
  });

  it("points at the gap between them and not at the word after it", () => {
    // `}` ends at column 41, `print` starts at 43, so the space is column 42.
    expect(at('flow "F" { step "s" { if true { print 1 } print 2 } }')).toBe("1:42");
  });

  /**
   * The token that may begin a statement is read out of the grammar, so this
   * holds for every keyword the language has rather than for a list somebody
   * remembered to keep up to date.
   */
  it.each([
    ['flow "F" { step "s" { let a = 1 let b = 2 } }', "let"],
    ["loop n = 0 { if n > 3 { break } continue n + 1 }", "continue"],
    ['flow "F" { step "s" { if true { print 1 } if false { print 2 } } }', "if"],
    ['flow "F" { on failure { print 1 } on success { print 2 } }', "on"],
    ['flow "F" { group "g" { step "s" { print 1 } step "t" { print 2 } } }', "step"],
    ['flow "F" { step "s" { expect 1 == 1 expect 2 == 2 } }', "expect"],
    ['flow "F" { step "s" { forEach x in [1,2] { print x } print 3 } }', "print"],
  ])("says it wherever the next statement begins (%s)", (source) => {
    expect(titles(source)[0]).toBe(STATEMENTS);
  });

  /**
   * A `fn` body separates its statements the same way and fails differently:
   * the parser asks for the separator itself rather than running into a brace.
   */
  it("says it in a fn body, where the parser asked for the separator itself", () => {
    expect(titles("fn f() { let a = 1 return a }")[0]).toBe(STATEMENTS);
    expect(titles("fn f() {\n  let a = 1 let b = 2\n  return a\n}")[0]).toBe(STATEMENTS);
  });

  /**
   * The top level does not require a separator, so nothing is said there.
   *
   * `Document` and `NamespaceDecl` trail each declaration with `NL*` where a
   * `Block` puts `NL+` between them, and this is read off whichever shape the
   * grammar has rather than off a belief about where braces are.
   */
  it("says nothing where the grammar does not require a separator", () => {
    expect(titles("const a = 1 const b = 2")).toEqual([]);
    expect(titles("namespace N { const a = 1 const b = 2 }")).toEqual([]);
  });

  /** A `;` is an `NL` token, so the sentence is advice that compiles. */
  it("says nothing once the separator is written", () => {
    expect(titles('flow "F" { step "s" { if true { print 1 }; print 2 } }')).toEqual([]);
    expect(titles("fn f() { let a = 1; return a }")).toEqual([]);
  });
});

/**
 * The lists that take a comma as well as a newline.
 *
 * Telling somebody writing `{ a: 1 b: 2 }` to reach for a `;` is true and is
 * not what they meant, so they are told about the comma instead. Which of the
 * two sentences applies is read off the grammar's own separator group.
 */
describe("an entry separator nobody wrote", () => {
  it.each([
    ['const r = match 1 { 1 => "a" _ => "b" }', "match arms"],
    ["const m = { a: 1 b: 2 }", "a map literal"],
    ["type T = { a: string b: number }", "a type body"],
    ["const { a b } = m", "a shape pattern"],
  ])("names the comma for %s", (source) => {
    expect(titles(source)[0]).toBe(ENTRIES);
  });

  it("says nothing once the comma is written", () => {
    expect(titles('const r = match 1 { 1 => "a", _ => "b" }')).toEqual([]);
    expect(titles("const m = { a: 1, b: 2 }")).toEqual([]);
  });
});

/**
 * What the closing-brace sentence is actually for.
 *
 * It has to survive, because a brace nobody closed is the one mistake it names
 * correctly. Nothing here can begin another statement, so nothing here is a
 * missing separator.
 */
describe("a brace nobody closed", () => {
  it("still says the closing brace is what was wanted", () => {
    const said = titles('flow "F" {\n  step "s" {\n    print 1\n  }\n');

    expect(said[0]).toBe("Expected a closing brace here, found the end of the file.");
  });

  it("says nothing about a separator when the token cannot start a statement", () => {
    expect(titles('flow "F" { @timeout 50ms }')[0]).toContain("decorator takes its argument");
  });
});
