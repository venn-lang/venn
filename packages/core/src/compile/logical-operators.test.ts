import { describe, expect, it } from "vitest";
import type { EvalEnv } from "../expr/eval-env.types.js";
import { evaluate } from "../expr/evaluate.js";
import { nativeFn } from "../expr/native.types.js";
import type { Document, LetStmt } from "../generated/ast.js";
import { parse } from "../parse/index.js";

/** What each name answers, including the three that answer late. */
const bindings: Record<string, unknown> = {
  nothing: null,
  no: false,
  yes: "here",
  slowNothing: nativeFn(() => Promise.resolve(null)),
  slowNo: nativeFn(() => Promise.resolve(false)),
  slowYes: nativeFn(() => Promise.resolve("here")),
  counted: nativeFn(() => {
    calls += 1;
    return calls;
  }),
};

let calls = 0;
const env: EvalEnv = { lookup: (name) => bindings[name] };

function value(expression: string): unknown {
  const document = parse(`const it = ${expression}`).ast as Document;
  return evaluate((document.decls[0] as LetStmt).value, env);
}

describe("what each logical operator decides on", () => {
  it("coalesces on nothing, not on false", () => {
    expect(value('nothing ?? "instead"')).toBe("instead");
    expect(value('no ?? "instead"')).toBe(false);
    expect(value('yes ?? "instead"')).toBe("here");
  });

  it("hands back an operand rather than a verdict", () => {
    expect(value('no || "instead"')).toBe("instead");
    expect(value('yes && "second"')).toBe("second");
    expect(value('no && "unreachable"')).toBe(false);
  });

  it("evaluates the left side once", () => {
    calls = 0;
    expect(value('counted() ?? "instead"')).toBe(1);
    expect(calls).toBe(1);
  });
});

/**
 * A value that has not arrived yet.
 *
 * Every node that meets one chains onto it, which is what lets a program reach
 * for something slow without writing `await`. These three did not: a promise is
 * neither nothing nor false, so each decided against the promise itself. `??`
 * handed back the promise it was asked to replace, and `&&` ran the right side
 * whatever the left side turned out to be.
 */
describe("a left side that has not arrived", () => {
  it("is waited for before coalescing", async () => {
    expect(await value("slowNothing() ?? 8080")).toBe(8080);
    expect(await value("slowNo() ?? 8080")).toBe(false);
  });

  it("is waited for before deciding an or", async () => {
    expect(await value('slowNo() || "instead"')).toBe("instead");
    expect(await value('slowYes() || "instead"')).toBe("here");
  });

  it("is waited for before deciding an and", async () => {
    expect(await value('slowNo() && "unreachable"')).toBe(false);
    expect(await value('slowYes() && "second"')).toBe("second");
  });

  it("waits once, and the right side is still only asked for when needed", async () => {
    calls = 0;
    expect(await value("slowNothing() ?? counted()")).toBe(1);
    expect(await value("slowYes() ?? counted()")).toBe("here");
    expect(calls).toBe(1);
  });
});
