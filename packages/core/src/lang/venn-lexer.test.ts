import { describe, expect, it } from "vitest";
import type { Call, Document, FnExpr, LetStmt, MapLit } from "../generated/ast.js";
import { parse } from "../parse/index.js";
import { spanOf } from "../span/index.js";

/** Parse, and report the titles rather than the count when something breaks. */
function ast(source: string): Document {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  return ast as Document;
}

/** The function literal in `const a = f(fn …)`, which is what these bind. */
function argument(source: string): FnExpr {
  const decl = ast(source).decls[0] as LetStmt;
  const args = (decl.value as Call).args;
  return args?.args[0]?.value as FnExpr;
}

/**
 * A newline is the only thing that ends a statement, so a block written inside
 * a call has to keep the ones the arg list drops around it.
 */
describe("a block body written as an argument", () => {
  it("holds statements before its result", () => {
    const fn = argument("const a = use(fn (n) { const m = n + 1\n  return m })\n");

    expect(fn.$type).toBe("FnExpr");
    expect(fn.body.stmts).toHaveLength(1);
    expect(fn.body.result.$type).toBe("Ref");
  });

  it("holds them when the block is spread over its own lines", () => {
    const fn = argument("const a = use(fn (n) {\n  const m = n + 1\n  return m\n})\n");

    expect(fn.body.stmts.map((stmt) => stmt.$type)).toEqual(["LetStmt", "ReturnStmt"]);
  });

  it("still parses when the block is nothing but its result", () => {
    const fn = argument("const a = use(fn (n) { return n })\n");

    expect(fn.body.stmts).toHaveLength(0);
    expect(fn.body.result.$type).toBe("Ref");
  });

  it("parses the same block bound to a name first", () => {
    const decl = ast("const f = fn (n) { const m = n + 1\n  return m }\n").decls[0] as LetStmt;

    expect((decl.value as FnExpr).body.stmts).toHaveLength(1);
  });

  it("parses the decorator the documentation writes", () => {
    const source = `deco memo(target: Fn) {
  target.wrap(fn (call, args) {
    const key = "\${args}"
    return call(args)
  })
}
`;

    expect(ast(source).decls).toHaveLength(1);
  });

  it("parses inside a list literal too", () => {
    const source = "const fns = [fn (n) { const m = n + 1\n  return m }]\n";

    expect(ast(source).decls).toHaveLength(1);
  });
});

/**
 * The newline still goes missing between the arguments themselves, which is
 * what lets a call spread over lines without a separator on each one.
 */
describe("a bracket that drops newlines", () => {
  it("lets an argument list span lines", () => {
    const decl = ast("const a = use(\n  1,\n  2\n)\n").decls[0] as LetStmt;

    expect((decl.value as Call).args?.args).toHaveLength(2);
  });

  it("lets a list literal span lines", () => {
    expect(ast("const xs = [\n  1,\n  2,\n]\n").decls).toHaveLength(1);
  });

  it("gives the newline back to a map written inside a call", () => {
    const decl = ast("const a = use({ a: 1\n  b: 2 })\n").decls[0] as LetStmt;
    const map = (decl.value as Call).args?.args[0]?.value as MapLit;

    expect(map.entries).toHaveLength(2);
  });

  it("keeps taking a comma there, for the map written on one line", () => {
    const decl = ast("const a = use({ a: 1, b: 2 })\n").decls[0] as LetStmt;
    const map = (decl.value as Call).args?.args[0]?.value as MapLit;

    expect(map.entries).toHaveLength(2);
  });
});

const BOM = "\ufeff";

/** Where every problem in a source is said to be, as `line:column`. */
function columnsOf(source: string): string[] {
  return parse(source).problems.map((one) => `${one.span.line}:${one.span.column}`);
}

/** Where the value of the first declaration is said to be, as `line:column`. */
function nameColumn(source: string): string {
  const span = spanOf((ast(source).decls[0] as LetStmt).value, "/main.vn");
  return `${span.line}:${span.column}`;
}

/**
 * Windows editors, PowerShell's `Set-Content` and `Out-File`, and several CI
 * checkout paths all write a byte-order mark at the top of a file by default.
 * One made the whole file unreadable: `VN1001 . unexpected character: -><- at
 * offset: 0, skipped 1 characters.`, and nothing else in the file was reported.
 */
describe("a file that starts with a byte-order mark", () => {
  it("parses as the same file without one", () => {
    const source = 'flow "F" {\n  step "s" {\n    print 1\n  }\n}\n';

    expect(parse(BOM + source).problems).toEqual([]);
    expect(ast(BOM + source).decls).toHaveLength(1);
  });

  /**
   * Written over rather than cut out, so a span still points at the character
   * it means: the mark is one character of the file the editor has open, and a
   * report that skipped it would land one place to the left of the mistake.
   */
  it("points at the same character the file without one points at", () => {
    const source = "const a = 1\nprint a +\n";
    const marked = BOM + source;
    const span = parse(marked).problems[0]?.span;

    expect(marked[span?.offset ?? 0]).toBe("+");
    expect(span?.line).toBe(parse(source).problems[0]?.span.line);
    expect(span?.column).toBe(parse(source).problems[0]?.span.column);
  });

  /**
   * The mark is not a character an editor draws, so the column beside a file
   * name is the same one whether the file carries one or not. Line one is
   * where that is felt: further down only the offset moves, and it should.
   *
   * One source per place a column is counted from: the token the lexer read,
   * the end of a file the parser ran off, and the line a scan matched a
   * removed word on, which used to match nothing at all through a mark.
   */
  it.each([
    ["a bracket nobody closed", "const a = (1 + 2"],
    ["a keyword where a name goes", "let in = 1"],
    ["a character the lexer refuses", "const x = \u00a7"],
    ["a word the language dropped", "while ok { print 1 }"],
  ])("names the column an editor shows for %s", (_what, source) => {
    expect(columnsOf(BOM + source)).toEqual(columnsOf(source));
    expect(columnsOf(source).length).toBeGreaterThan(0);
  });

  /**
   * And the offset still counts it, because that is what the editor turns into
   * a range against the very text it has open, mark and all.
   */
  it("still points the offset at the character it means", () => {
    const marked = `${BOM}const a = (1 + 2`;
    const span = parse(marked).problems[0]?.span;

    expect(marked[span?.offset ?? 0]).toBe("(");
    expect(span?.line).toBe(1);
  });

  /**
   * The other place a column comes from: a node a check points at, rather than
   * a token the parser stopped at. It is proved apart because it is the one an
   * editor also builds ranges from.
   */
  it("names the column an editor shows for a node a check points at", () => {
    const source = "const alpha = 1\n";

    expect(nameColumn(BOM + source)).toEqual(nameColumn(source));
  });

  /**
   * On line one a `character` and an offset are the same number, so a node
   * whose two disagree is a contradiction inside one CST node. Taking the mark
   * off the token used to make every line-one node one of those, and rename,
   * which reads the range and not the offset, rewrote the wrong characters.
   */
  it("leaves a node's range and its offset agreeing on line one", () => {
    const cst = ast(`${BOM}const alpha = 1\n`).decls[0]?.$cstNode;

    expect(cst?.range.start.line).toBe(0);
    expect(cst?.range.start.character).toBe(cst?.offset);
  });
});

/** The three ways of writing a leading `.` that are a mistake and stay one. */
const NOT_A_CHAIN: [string, string][] = [
  ["across a blank line, which is how a reader separates two things", "const n = xs\n\n  .len\n"],
  ["past a `;`, which is the writer ending the statement", "const n = xs;\n  .len\n"],
  ["for a keyword, since one opens a statement", "const n = xs\n  .return 1\n"],
];

/**
 * Breaking a long chain over lines is what a reader does the moment the line
 * gets long, and the only way to write one was brackets that defeat this walk.
 */
describe("a chain broken across lines", () => {
  it.each([
    ["a wrapped chain", "const n = xs\n  .filter(x => x > 1)\n  .len\n"],
    ["the optional spelling", "const n = xs\n  .filter(x => x > 1)\n  ?.len\n"],
    ["a comment line between, where a note about it goes", "const n = xs\n  # why\n  .len\n"],
  ])("reads as the one expression it looks like, %s", (_what, source) => {
    expect((ast(source).decls[0] as LetStmt).value.$type).toBe("Member");
  });

  it.each(NOT_A_CHAIN)("does not reach %s", (_what, source) => {
    expect(parse(source).problems[0]?.title).toContain("found a dot");
  });
});
