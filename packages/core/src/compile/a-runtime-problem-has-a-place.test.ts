import { describe, expect, it } from "vitest";
import { type EvalEnv, evaluate, nativeFn } from "../expr/index.js";
import type { Document, FnDecl, LetStmt } from "../generated/ast.js";
import { isFnDecl } from "../generated/ast.js";
import { parse } from "../parse/index.js";
import type { Problem, ProblemError } from "../problem/index.js";
import { closureOfDecl } from "./compile.js";

const URI = "memory://run.vn";

/** Every `fn` the source declares, and a stand-in verb for any other name. */
function worldOf(document: Document): EvalEnv {
  const known = new Map<string, unknown>();
  const env: EvalEnv = {
    lookup: (name) => {
      if (name === "nothing") return undefined;
      if (known.has(name)) return known.get(name);
      const decl = document.decls.find((each) => isFnDecl(each) && each.name === name);
      known.set(name, decl ? closureOfDecl(decl as FnDecl, env) : nativeFn(() => name));
      return known.get(name);
    },
  };
  return env;
}

/** Evaluate the value of the last binding, and hand back what it refused with. */
function refusal(source: string): Problem {
  const document = parse(source, { uri: URI }).ast as Document;
  const last = document.decls.at(-1) as LetStmt;
  try {
    evaluate(last.value, worldOf(document));
  } catch (thrown) {
    return (thrown as ProblemError).problem;
  }
  throw new Error(`${source} did not refuse`);
}

/**
 * A compile diagnostic says where it is and a runtime one did not, which is
 * backwards: the runtime one fires on real data, when the author is furthest
 * from the source and least able to guess which of three lambdas it came from.
 */
describe("where a refusal happened", () => {
  it("points at the operation, not at the file", () => {
    expect(refusal('const a = "lots" * 2').span).toMatchObject({ uri: URI, line: 1, column: 11 });
  });

  it("covers the whole operation, so an editor underlines it", () => {
    expect(refusal('const a = "lots" * 2').span.length).toBe('"lots" * 2'.length);
  });

  it("points inside a function body, not at the line that called it", () => {
    const source = ["fn f(q) => q * 2", 'const a = f("lots")'].join("\n");
    expect(refusal(source).span).toMatchObject({ line: 1, column: 12 });
  });
});

/**
 * Nothing is written `null` on its own, because the value and the kind are the
 * same word there and saying it twice reads as two facts. A list is named by
 * its kind alone, because it was refused for being one and its contents change
 * nothing about that.
 */
describe("which values an operator refused", () => {
  it.each([
    ['"lots" * 2', 'Operator "*" cannot be applied to "lots" (a string) and 2 (a number).'],
    ["nothing >= 2", 'Operator ">=" cannot be applied to null and 2 (a number).'],
    ["[1, 2] * 2", 'Operator "*" cannot be applied to a list and 2 (a number).'],
  ])("names both sides of %s", (expression, said) => {
    expect(refusal(`const a = ${expression}`).title).toBe(said);
  });
});

describe("what a value that is not a function is called", () => {
  it("uses the language's word for it and never the host's", () => {
    expect(refusal("const a = nothing()").title).toBe(
      "This value is not a function, so it cannot be called: null.",
    );
  });

  it("points at the call", () => {
    expect(refusal("const a = nothing()").span).toMatchObject({ uri: URI, line: 1, column: 11 });
  });
});
