import { describe, expect, it } from "vitest";
import { call, program, raised } from "./a-fn-may-fail.suite.js";

/**
 * A `fn` may fail.
 *
 * Raising is control flow rather than an effect on the world, so `fail` is
 * compiled as a raise rather than as a call to the verb of that name. Before
 * this, refusing an argument cost the author a `fragment` and a `run … as`,
 * which is the first wall a program hits: "validate and refuse" is the most
 * common shape there is.
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
 * Both spellings work in a compiled body: the braced one holds an expression per
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
