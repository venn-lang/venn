import { describe, expect, it } from "vitest";
import type { Call, Document, FnExpr, LetStmt, MapLit } from "../generated/ast.js";
import { parse } from "../parse/index.js";

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
});

/**
 * A newline is dropped inside `(` and `[`, so one nobody closed runs the rest
 * of the file into a single statement: every other mistake in it stops being
 * reportable, and what came out was one line about the end of the file.
 */
describe("a bracket nobody closed", () => {
  it("says which bracket it was, where it was opened", () => {
    const found = parse("print (1\nprint 2\nprint 3\n").problems;

    expect(found).toHaveLength(1);
    expect(found[0]?.code).toBe("VN1001");
    expect(found[0]?.title).toBe(
      "This `(` is never closed, so the rest of the file is read as part of it.",
    );
    expect(found[0]?.span.line).toBe(1);
    expect(found[0]?.span.column).toBe(7);
  });

  it("says the same for a list nobody closed", () => {
    expect(parse("print a[1\n").problems[0]?.title).toContain("`[` is never closed");
  });

  it("leaves a file whose brackets all close alone", () => {
    expect(parse("print (1)\nprint [2]\n").problems).toEqual([]);
  });
});
