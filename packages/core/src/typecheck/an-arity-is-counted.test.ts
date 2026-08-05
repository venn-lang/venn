import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";

/** Type-check a program and return `CODE title` for each problem. */
function said(...lines: string[]): string[] {
  const { ast, problems } = parse(lines.join("\n"));
  expect(problems.map((problem) => problem.title)).toEqual([]);
  return checkTypes(ast).problems.map((problem) => `${problem.code} ${problem.title}`);
}

/**
 * A call handed the wrong number of arguments used to be reported as the two
 * function types that failed to unify, in the order that reads backwards:
 * `expected fn(number) -> a, found fn(a, b) -> a` describes the call site first
 * and the declaration second, so a reader parses "I expected one and found two"
 * when the truth is the reverse.
 */
describe("a call with the wrong number of arguments", () => {
  it("counts, and names the function", () => {
    expect(said("fn f(a, b) => a", "print f(1)")).toEqual([
      "VN3002 `f` takes 2 arguments, and got 1.",
    ]);
  });

  it("counts too many the same way", () => {
    expect(said("fn f(a) => a", "print f(1, 2)")).toEqual([
      "VN3002 `f` takes 1 argument, and got 2.",
    ]);
  });

  it("says none rather than zero", () => {
    expect(said("fn f() => 1", "print f(1)")).toEqual([
      "VN3002 `f` takes no arguments, and got 1.",
    ]);
  });

  it("names a member call by its member", () => {
    expect(said('print "abc".slice(1, 2, 3)')[0]).toContain("`slice` takes");
  });

  it("points at the call, not at the declaration", () => {
    const { ast } = parse("fn f(a, b) => a\nprint f(1)");
    const [found] = checkTypes(ast).problems;

    expect(found?.span.line).toBe(2);
  });
});

describe("a lambda of the wrong arity", () => {
  it("counts what it takes against what it is given", () => {
    expect(said("print [1, 2].map((a, b, c) => a)")).toEqual([
      "VN3002 This lambda takes 3 arguments, and is given 2.",
    ]);
  });

  it("says what it needs at least, where it takes too few", () => {
    expect(said("print [1, 2].map(() => 9)")).toEqual([
      "VN3002 This lambda takes no arguments, and needs at least 1.",
    ]);
  });

  /** A callback may ignore what it is offered, which is the common case. */
  it("says nothing when the lambda ignores the arguments after the first", () => {
    expect(said("print [1, 2].map(a => a)")).toEqual([]);
  });

  it("says nothing when the lambda takes every one it is offered", () => {
    expect(said("print [1, 2].map((a, at) => a + at)")).toEqual([]);
  });
});

describe("what the count leaves alone", () => {
  it("still reports the argument that does not fit, by type", () => {
    expect(said("fn f(a: number) => a", 'print f("x")')[0]).toContain("expected number");
  });

  /** A member left out on purpose, which `ignorableFrom` allows. */
  it("says nothing about an optional argument that was not written", () => {
    expect(said('print "a".padStart(3)')).toEqual([]);
  });

  it("says nothing to a variadic, which takes what it is given", () => {
    expect(said('print str(1, "a", true)')).toEqual([]);
  });
});
