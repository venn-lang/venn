import { describe, expect, it } from "vitest";
import { buildProblem, CODES } from "../codes/index.js";
import type { EvalEnv } from "../expr/eval-env.types.js";
import { evaluate } from "../expr/evaluate.js";
import { callClosure } from "../expr/invoke.js";
import { nativeFn } from "../expr/native.types.js";
import type { Document, FnDecl, LetStmt } from "../generated/ast.js";
import { parse } from "../parse/index.js";
import { ProblemError } from "../problem/index.js";
import { closureOfDecl } from "./compile.js";

const NO_SPAN = { uri: "", offset: 0, length: 0, line: 1, column: 1 };

/** A verb that fails the way a plugin's does, and one that does not. */
function world(): EvalEnv {
  const bindings: Record<string, unknown> = {
    boom: nativeFn(() => {
      throw new ProblemError(
        buildProblem({ spec: CODES.VN3013_NOT_CALLABLE, span: NO_SPAN, title: "It blew up." }),
      );
    }),
    fine: nativeFn((args) => args[0]),
    leave: nativeFn(() => {
      throw new Leaving();
    }),
  };
  return { lookup: (name) => bindings[name] };
}

/** A control signal: deliberately not an `Error`, the way the runtime's are. */
class Leaving {}

function value(expression: string, env: EvalEnv = world()): unknown {
  const document = parse(`const it = ${expression}`).ast as Document;
  return evaluate((document.decls[0] as LetStmt).value, env);
}

/**
 * `try` where a value is wanted.
 *
 * The statement form recovers where steps run and cannot hand a value out, and
 * there is no assignment inside a `fn` body to catch one with, so "try this,
 * and if it fails use that" could not be written where the value was needed.
 */
describe("trying for a value", () => {
  it("hands back the attempt when it works", () => {
    expect(value('try fine("ok") else "instead"')).toBe("ok");
  });

  it("hands back the fallback when it fails", () => {
    expect(value('try boom() else "instead"')).toBe("instead");
  });

  it("gives the failure a name when asked", () => {
    expect(value("try boom() catch e => e.message")).toBe("It blew up.");
    expect(value("try boom() catch e => e.code")).toBe("VN3013");
  });

  it("leaves the name out of scope when it works", () => {
    expect(value("try fine(1) catch e => e.message")).toBe(1);
  });

  it("takes any expression as the fallback", () => {
    expect(value("try boom() else 1 + 1")).toBe(2);
    expect(value("try boom() else { a: 1 }")).toEqual({ a: 1 });
  });

  it("nests, so a second attempt can stand in for the first", () => {
    expect(value('try boom() else (try boom() else "last")')).toBe("last");
  });

  /**
   * A `break`, a `return` or an `exit` is the program going where it was told.
   * Catching one would turn a loop's `break` into a failed attempt.
   */
  it("does not catch the program leaving", () => {
    expect(() => value('try leave() else "instead"')).toThrow(Leaving);
  });

  it("binds looser than everything, so the whole attempt is the attempt", () => {
    expect(value("try fine(2) * 3 else 0")).toBe(6);
  });
});

/**
 * A compiled body addresses slots, not names, so a `catch` name has to be one of
 * them. Handing the failure over in a scope of its own would leave the fallback
 * reading a slot nobody wrote, which answered `null` for every `catch` in a
 * function.
 */
describe("the name a catch binds, inside a function", () => {
  it("reaches the fallback", () => {
    expect(call("fn why(xs) => try xs.missing() catch e => e.code")).toBe("VN3013");
  });

  it("reaches it from a body with statements", () => {
    const source = [
      "fn why(xs) {",
      "  const said = try xs.missing() catch e => e.code",
      "  return said",
      "}",
    ].join(String.fromCharCode(10));

    expect(call(source)).toBe("VN3013");
  });

  /** Two of them share a slot, which is safe because only one is ever written. */
  it("takes the same name twice in one body", () => {
    const source = [
      "fn why(xs) {",
      "  const first = try xs.missing() catch e => e.code",
      '  const second = try xs.gone() catch e => "then ${e.code}"',
      "  return [first, second]",
      "}",
    ].join(String.fromCharCode(10));

    expect(call(source)).toEqual(["VN3013", "then VN3013"]);
  });
});

/** Compile the one `fn` in `source` and call it with a list. */
function call(source: string): unknown {
  const document = parse(source).ast as Document;
  const closure = closureOfDecl(document.decls[0] as FnDecl, world());
  return callClosure(closure, [[1]]);
}
