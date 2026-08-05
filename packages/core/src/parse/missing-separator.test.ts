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

/** The separator the sentence named, written into the gap it pointed at. */
function repaired(source: string): string {
  const [problem] = parse(source).problems;
  const separator = problem?.title === ENTRIES ? "," : ";";
  const offset = problem?.span.offset ?? 0;
  return `${source.slice(0, offset)}${separator}${source.slice(offset)}`;
}

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
});

/** A member read on a line of its own, which `FnStmt` does not admit. */
const A_READ_IN_A_FN = "fn f(x) {\n  x.toString\n  return x\n}\nprint f(1)\n";

/**
 * A gap already holding a newline or a `;` is not a gap a separator is missing
 * from, whatever else the parser refused there.
 *
 * `FnStmt` admits a bare-argument call and no other, so a member call written as
 * a statement in a `fn` body fails on the statement after it, with the newline
 * between them right where a reader put it. Writing the `;` the sentence asked
 * for returned the same two errors one column along.
 */
describe("a separator the reader already wrote", () => {
  it.each([
    ["a discarded read", A_READ_IN_A_FN],
    ["a verb call", 'fn f(x) {\n  io.eprint("x")\n  return x\n}\n'],
    ["a method call", "fn f(xs) {\n  xs.push(3)\n  return xs\n}\n"],
  ])("says nothing about %s on a line of its own", (_what, source) => {
    expect(titles(source)).not.toContain(STATEMENTS);
  });

  it("leaves the parser's own line, which names the token it refused", () => {
    expect(titles(A_READ_IN_A_FN)[0]).toBe("Expected a closing brace here, found `return`.");
    expect(at(A_READ_IN_A_FN)).toBe("3:3");
  });
});

/**
 * The sentence names a separator instead of rewriting the reader's line, so
 * what has to hold is that writing one where it pointed leaves nothing at all.
 *
 * The separator goes in at the explainer's own offset rather than by hand, so a
 * span that drifts off the gap fails here instead of shipping advice that lands
 * inside a token.
 */
describe("the separator written where the sentence pointed", () => {
  it.each([
    'flow "F" { step "s" { if true { print 1 } print 2 } }',
    'const r = match 1 { 1 => "a" _ => "b" }',
    "loop n = 0 { if n > 3 { break } continue n + 1 }",
    "fn f() { let a = 1 return a }",
  ])("repairs the line that earned it, reporting nothing (%s)", (source) => {
    expect(titles(repaired(source))).toEqual([]);
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
