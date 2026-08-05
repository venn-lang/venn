import { describe, expect, it } from "vitest";
import type { Closure, EvalEnv } from "../expr/index.js";
import { callClosure } from "../expr/index.js";
import type { Document, FnDecl } from "../generated/ast.js";
import { isFnDecl } from "../generated/ast.js";
import { parse } from "../parse/index.js";
import { type Problem, ProblemError } from "../problem/index.js";
import { closureOfDecl } from "./compile.js";

const NEWLINE = String.fromCharCode(10);

/** Parse a program and call its `f`, letting whatever it raises out. */
function call(lines: string[], args: unknown[]): unknown {
  const parsed = parse(lines.join(NEWLINE));
  expect(parsed.problems.map((problem) => problem.title)).toEqual([]);
  const bindings: Record<string, Closure> = {};
  const env: EvalEnv = { lookup: (bound) => bindings[bound] };
  for (const decl of (parsed.ast as Document).decls) {
    if (isFnDecl(decl)) bindings[decl.name] = closureOfDecl(decl as FnDecl, env);
  }
  return callClosure(bindings.f as Closure, args);
}

/** The problem the call refused with, or nothing when it answered. */
function refusal(lines: string[], args: unknown[]): Problem | undefined {
  try {
    call(lines, args);
    return undefined;
  } catch (thrown) {
    if (thrown instanceof ProblemError) return thrown.problem;
    throw thrown;
  }
}

/**
 * A `fn` body is compiled rather than walked, so it takes a pattern apart by a
 * different mechanism from the scheduler and has to ask the same question.
 */
describe("a pattern in a compiled body", () => {
  it("refuses a parameter pattern the argument is too short for", () => {
    const found = refusal(["fn f([a, b, c]) => a"], [[1, 2]]);

    expect(found).toMatchObject({
      code: "VN3026",
      title: "This pattern names 3 items, and the list has 2.",
    });
  });

  it("refuses a `let` pattern inside the body", () => {
    const found = refusal(["fn f(xs) {", "  let [a, b, c] = xs", "  return a", "}"], [[1, 2]]);

    expect(found?.code).toBe("VN3026");
  });

  it("refuses a `forEach` pattern inside the body", () => {
    const lines = ["fn f(rows) {", "  forEach [a, b] in rows {", "    return a", "  }", "}"];

    expect(refusal(lines, [[[1, 2, 3]]])?.code).toBe("VN3026");
  });

  it("answers when the parameter pattern fits exactly", () => {
    expect(call(["fn f([a, b]) => a + b"], [[1, 2]])).toBe(3);
  });

  it("answers when a `...rest` takes the remainder", () => {
    expect(call(["fn f([a, ...rest]) => rest"], [[1, 2, 3]])).toEqual([2, 3]);
  });

  it("answers for a pair, which is how `entries` is read", () => {
    const lines = ["fn f(pairs) {", "  forEach [k, v] in pairs {", "    return v", "  }", "}"];

    expect(call(lines, [[["a", 1]]])).toBe(1);
  });

  it("leaves a map pattern alone", () => {
    expect(call(["fn f({ a, b }) => a + b"], [{ a: 1, b: 2 }])).toBe(3);
  });
});
