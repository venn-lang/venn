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
