// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Venn source under test.
import { describe, expect, it } from "vitest";
import { closureOfDecl } from "../compile/index.js";
import type { Document, FnDecl } from "../generated/ast.js";
import { isFnDecl, isLetStmt } from "../generated/ast.js";
import { parse } from "../parse/index.js";
import { childEnv } from "./closure.js";
import type { EvalEnv } from "./eval-env.types.js";
import { evaluate } from "./evaluate.js";
import { callClosure } from "./invoke.js";

/** Parse a program and evaluate `expr` with its top-level `fn`s in scope. */
function run(source: string, expr: string): unknown {
  const program = parse(source).ast as Document;
  const bindings: Record<string, unknown> = {};
  const env: EvalEnv = { lookup: (name) => bindings[name] };
  for (const decl of program.decls) {
    if (isFnDecl(decl)) bindings[decl.name] = closureOfDecl(decl, env);
    else if (isLetStmt(decl)) bindings[decl.name] = evaluate(decl.value, env);
  }
  const main = (parse(`fn __main() => ${expr}`).ast as Document).decls[0] as FnDecl;
  return callClosure(closureOfDecl(main, env), []);
}

describe("closures", () => {
  it("calls a named function with an arrow body", () => {
    expect(run("fn double(x) => x * 2", "double(21)")).toBe(42);
  });

  it("returns the last expression of a block body implicitly", () => {
    expect(run("fn area(w, h) {\n const a = w * h\n a\n}", "area(6, 7)")).toBe(42);
  });

  it("still accepts an explicit `return`", () => {
    expect(run("fn id(x) { return x }", "id(9)")).toBe(9);
  });

  it("recurses", () => {
    expect(run("fn fib(n) => n < 2 ? n : fib(n - 1) + fib(n - 2)", "fib(10)")).toBe(55);
  });

  it("closes over the defining scope", () => {
    expect(run("const base = 100\nfn add(x) => x + base", "add(5)")).toBe(105);
  });

  it("treats a function as a value that can be passed and called", () => {
    const source = "fn apply(f, x) => f(x)\nfn inc(n) => n + 1";
    expect(run(source, "apply(inc, 41)")).toBe(42);
  });

  it("evaluates an anonymous function inline", () => {
    expect(run("", "(fn (a, b) => a + b)(3, 4)")).toBe(7);
  });
});

describe("scope lookup", () => {
  const parent: EvalEnv = { lookup: () => "from the parent" };

  it("finds what it binds, and defers the rest", () => {
    const env = childEnv(parent, { here: 1 });

    expect(env.lookup("here")).toBe(1);
    expect(env.lookup("elsewhere")).toBe("from the parent");
  });

  // `in` walks the prototype chain, so these names used to resolve to
  // JavaScript's own: `fn probe() => constructor` returned `function Object()`.
  it("does not let a name reach JavaScript's prototype", () => {
    const env = childEnv(parent, {});

    expect(env.lookup("constructor")).toBe("from the parent");
    expect(env.lookup("toString")).toBe("from the parent");
    expect(env.lookup("hasOwnProperty")).toBe("from the parent");
  });

  it("keeps a binding that genuinely holds nothing", () => {
    expect(childEnv(parent, { empty: undefined }).lookup("empty")).toBeUndefined();
  });
});

// The compiler turns a name the enclosing function binds into a slot number.
// These pin the cases where that must not happen, or must not happen twice.
describe("slots and scope", () => {
  it("reads a parameter, and still reaches what the file bound", () => {
    const source = "fn tenth(x) => x / factor";
    expect(run(`${source}\nlet factor = 10`, "tenth(50)")).toBe(5);
  });

  it("lets a lambda see the parameter of the function that made it", () => {
    const source = "fn scale(by) => fn (x) => x * by";
    expect(run(source, "scale(3)(7)")).toBe(21);
  });

  it("reads a parameter from inside interpolation", () => {
    const source = 'fn label(x) => "v=${x}"';
    expect(run(source, "label(4)")).toBe("v=4");
  });

  // Placeholders are parsed once per distinct text and shared, so the very same
  // expression node belongs to both functions. It must carry neither's slots.
  it("gives each function its own values when they share a literal", () => {
    const source = 'fn a(x) => "v=${x}"\nfn b(x) => "v=${x}"';
    expect(run(source, "a(1)")).toBe("v=1");
    expect(run(source, "b(2)")).toBe("v=2");
  });

  it("lets a local shadow a parameter", () => {
    const source = "fn f(x) {\n  let x = 100\n  x + 1\n}";
    expect(run(source, "f(1)")).toBe(101);
  });

  it("lets a local read the one declared before it", () => {
    const source = "fn f(n) {\n  let doubled = n * 2\n  let plus = doubled + 1\n  plus\n}";
    expect(run(source, "f(5)")).toBe(11);
  });

  it("recurses", () => {
    const source = "fn fib(n) => n < 2 ? n : fib(n - 1) + fib(n - 2)";
    expect(run(source, "fib(12)")).toBe(144);
  });
});
