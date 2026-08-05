import { describe, expect, it } from "vitest";
import type { Closure, EvalEnv } from "../expr/index.js";
import { callClosure } from "../expr/index.js";
import type { Document, FnDecl } from "../generated/ast.js";
import { isFnDecl } from "../generated/ast.js";
import { parse } from "../parse/index.js";
import { type Caught, caughtValue, type Problem, ProblemError } from "../problem/index.js";
import { closureOfDecl } from "./compile.js";

const NEWLINE = String.fromCharCode(10);

/** A program written as lines, the way a body has to be. */
function program(...lines: string[]): string {
  return lines.join(NEWLINE);
}

/** Parse a program and call one of its `fn`s, letting whatever it raises out. */
function call(source: string, name: string, args: unknown[] = []): unknown {
  const parsed = parse(source);
  expect(parsed.problems.map((problem) => problem.title)).toEqual([]);
  const bindings: Record<string, Closure> = {};
  const env: EvalEnv = { lookup: (bound) => bindings[bound] };
  for (const decl of (parsed.ast as Document).decls) {
    if (isFnDecl(decl)) bindings[decl.name] = closureOfDecl(decl as FnDecl, env);
  }
  return callClosure(bindings[name] as Closure, args);
}

/** What a caller reads out of the failure a call raised. */
function raised(source: string, args: unknown[] = []): Caught {
  try {
    call(source, "f", args);
  } catch (failure) {
    return caughtValue(failure);
  }
  throw new Error("the call did not raise");
}

/** The problem a compile refused with, for the verbs a pure body may not run. */
function refusal(source: string): Problem | undefined {
  try {
    call(source, "f");
  } catch (thrown) {
    if (thrown instanceof ProblemError) return thrown.problem;
  }
  return undefined;
}

/**
 * A `fn` may fail.
 *
 * Raising is not an effect on the world, so the guarantee worth keeping is that
 * a `fn` does no I/O rather than that it always returns. Before this, refusing
 * an argument cost the author a `fragment` and a `run … as`, which is the first
 * wall a program hits: "validate and refuse" is the most common shape there is.
 */
describe("a fn that fails", () => {
  it("raises the code the program chose", () => {
    const source = program("fn f(c) {", '  fail "no config" { code: "cfg.empty" }', "}");

    expect(raised(source, [""]).code).toBe("cfg.empty");
  });

  it("raises with no code of its own under VN6002", () => {
    expect(raised('fn f() { fail "no" }').code).toBe("VN6002");
  });

  it("carries the message and the payload a caller acts on", () => {
    const source = program(
      "fn f(c) {",
      '  fail "no config" { code: "cfg.empty", data: { file: c } }',
      "}",
    );
    const caught = raised(source, ["app.toml"]);

    expect({ message: caught.message, data: caught.data }).toEqual({
      message: "no config",
      data: { file: "app.toml" },
    });
  });

  it("points at the line that refused", () => {
    const source = program("fn f() {", '  fail "no"', "}");

    expect(raised(source).where).toContain(":2:3");
  });

  it("fails from inside an if, one level into the body", () => {
    const source = program(
      "fn f(c) {",
      '  if c == "" { fail "no config" { code: "cfg.empty" } }',
      "  return c",
      "}",
    );

    expect([call(source, "f", ["ok"]), raised(source, [""]).code]).toEqual(["ok", "cfg.empty"]);
  });

  it("is refused when it claims a code the language owns", () => {
    expect(raised('fn f() { fail "no" { code: "VN3010" } }').code).toBe("VN3022");
  });
});

/**
 * A function that can fail and cannot catch is half a feature.
 *
 * Both spellings work in a pure body: the braced one holds an expression per
 * brace and gives a value back, and the statement one holds statements, which is
 * where a `return` belongs.
 */
describe("a fn that catches", () => {
  const failing = program("fn g(c) {", '  fail "no config" { code: "cfg.empty" }', "}");

  it("reads the code through the braced spelling", () => {
    const source = program(failing, "fn f(c) {", "  return try { g(c) } catch e { e.code }", "}");

    expect(call(source, "f", [""])).toBe("cfg.empty");
  });

  it("reads the code through the arrow spelling", () => {
    const source = program(failing, "fn f(c) {", "  return try g(c) catch e => e.code", "}");

    expect(call(source, "f", [""])).toBe("cfg.empty");
  });

  it("falls back with else and no binding at all", () => {
    const source = program(failing, "fn f(c) {", "  return try { g(c) } else { 0 }", "}");

    expect(call(source, "f", [""])).toBe(0);
  });

  it("catches its own fail in the statement spelling", () => {
    const source = program(
      "fn f(c) {",
      "  try {",
      '    fail "no config" { code: "cfg.empty" }',
      "  } catch e {",
      "    return e.code",
      "  }",
      "}",
    );

    expect(call(source, "f", [""])).toBe("cfg.empty");
  });

  it("lets the attempt's value through when nothing failed", () => {
    const source = program(failing, "fn f(c) {", "  return try { c.len } catch e { 0 }", "}");

    expect(call(source, "f", ["abcd"])).toBe(4);
  });

  it("does not catch a return, which is the function leaving", () => {
    const source = program(
      "fn f(c) {",
      "  try {",
      "    return c",
      "  } catch e {",
      '    return "caught"',
      "  }",
      "}",
    );

    expect(call(source, "f", ["ok"])).toBe("ok");
  });

  it("runs a finally after the handler", () => {
    const source = program(
      "fn f(c) {",
      '  let seen = "start"',
      "  try {",
      '    fail "no"',
      "  } catch e {",
      "    seen = e.code",
      "  } finally {",
      '    seen = "after ${seen}"',
      "  }",
      "  return seen",
      "}",
    );

    expect(call(source, "f", [""])).toBe("after VN6002");
  });
});

/**
 * Everything else a verb does reaches the world, so a pure body may not run it.
 *
 * The grammar parses one now, which is what lets the checker name it at the line
 * that wrote it. The compiler refuses the same shape in the same words, so a body
 * that reached the compiler without being checked cannot quietly drop the line,
 * which is what it used to do.
 */
describe("a verb that touches the world", () => {
  it("is refused in a body written on one line", () => {
    expect(refusal('fn f() { print "x" }')).toMatchObject({
      code: "VN2024",
      title:
        "A `fn` is pure, so it cannot call `print`. A verb belongs in a `fragment`, or at the top level of a file.",
    });
  });

  it("is refused in a body written over several", () => {
    const source = program("fn f() {", '  print "x"', "  return 1", "}");

    expect(refusal(source)?.code).toBe("VN2024");
  });

  it("is refused one level into the body", () => {
    const source = program("fn f(c) {", '  if c { log "x" }', "  return c", "}");

    expect(refusal(source)?.code).toBe("VN2024");
  });

  it("is refused inside a forEach, and inside an else", () => {
    const looped = program(
      "fn f(xs) {",
      "  forEach x in xs {",
      "    print x",
      "  }",
      "  return xs",
      "}",
    );
    const otherwise = program(
      "fn f(n) {",
      "  if n > 10 {",
      "    return n",
      "  } else {",
      '    print "small"',
      "  }",
      "  return 0",
      "}",
    );

    expect([refusal(looped)?.code, refusal(otherwise)?.code]).toEqual(["VN2024", "VN2024"]);
  });

  it("is refused when its result is bound", () => {
    const source = program("fn f() {", '  let a = print "x"', "  return a", "}");

    expect(refusal(source)?.code).toBe("VN2024");
  });
});

/**
 * The value of a body is still the last expression, and a statement must not be
 * able to claim it.
 *
 * `{ g(1) }` is a call and `{ xs[0] }` is an index, and a verb call reads either
 * as a name with an argument beside it. The shape of `FnBody` puts the value
 * first for exactly that reason, and these are the rows that hold it there.
 */
describe("the value of a body", () => {
  it("stays a call when the body is one", () => {
    const source = program("fn g(n) => n + 1", "fn f() {", "  g(1)", "}");

    expect(call(source, "f")).toBe(2);
  });

  it("stays an index when the body is one", () => {
    const source = program("fn f(xs) {", "  xs[0]", "}");

    expect(call(source, "f", [[7, 8]])).toBe(7);
  });

  it("stays a subtraction when the body is one", () => {
    const source = program("fn f(a) {", "  a - 1", "}");

    expect(call(source, "f", [10])).toBe(9);
  });

  it("is the last expression after a binding, not another statement", () => {
    const source = program("fn f(x) {", "  let a = x + 1", "  a", "}");

    expect(call(source, "f", [1])).toBe(2);
  });

  it("keeps the return that follows a binding", () => {
    const source = program("fn f(n) {", "  let m = n + 1", "  return m", "}");

    expect(call(source, "f", [1])).toBe(2);
  });
});
