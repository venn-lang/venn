import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";

const NEWLINE = String.fromCharCode(10);

/** Check a program and return what it reported, code and all. */
function said(...lines: string[]): string[] {
  const source = lines.join(NEWLINE);
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  return checkTypes(ast).problems.map((problem) => `${problem.code} ${problem.title}`);
}

/**
 * The ways out of a block body, as one type.
 *
 * A lookup answers with a value or with nothing, and a block with two `return`s
 * is how anybody writes one. Asking the second to agree with the first refused
 * that outright, and left the ternary as the only way to say it. So they make a
 * union, the same as the two sides of a `try`.
 */
describe("the returns of a block body", () => {
  it("takes a value or nothing, without an annotation", () => {
    const lines = [
      "fn problemWith(n) {",
      "  if n > 1 {",
      '    return "big"',
      "  }",
      "  return null",
      "}",
    ];

    expect(said(...lines)).toEqual([]);
  });

  it("hands the union to the caller", () => {
    const lines = [
      "fn problemWith(n) {",
      "  if n > 1 {",
      '    return "big"',
      "  }",
      "  return null",
      "}",
      "const why: string | null = problemWith(0)",
    ];

    expect(said(...lines)).toEqual([]);
  });

  it("is the whole union at the caller, not the first way out", () => {
    const lines = [
      "fn problemWith(n) {",
      "  if n > 1 {",
      '    return "big"',
      "  }",
      "  return null",
      "}",
      "const why: string = problemWith(0)",
    ];

    expect(said(...lines)[0]).toContain("expected string, found string | null");
  });

  /** Two ways out that agree are that type, not a union of a thing with itself. */
  it("stays the one type when every way out agrees", () => {
    const lines = [
      "fn letter(n) {",
      "  if n > 90 {",
      '    return "A"',
      "  }",
      '  return "F"',
      "}",
      "const bad: number = letter(0)",
    ];

    expect(said(...lines)[0]).toContain("expected number, found string");
  });

  /** A `return` with nothing after it is nothing, and belongs in the union too. */
  it("counts a bare return as nothing", () => {
    const lines = [
      "fn found(n) {",
      "  if n > 1 {",
      '    return "big"',
      "  }",
      "  return",
      "}",
      "const why: string | null = found(0)",
    ];

    expect(said(...lines)).toEqual([]);
  });

  it("finds a return however deep in the body it is written", () => {
    const lines = [
      "fn problemWith(n) {",
      "  if n > 1 {",
      "    if n > 100 {",
      '      return "far too big"',
      "    }",
      "  }",
      "  return null",
      "}",
      "const why: string | null = problemWith(0)",
    ];

    expect(said(...lines)).toEqual([]);
  });
});

/**
 * The annotation is still the contract.
 *
 * Nothing about the union loosens what was asked for: a declared type is what
 * every way out is measured against, and one that does not fit is the same
 * mistake it always was.
 */
describe("a block body under an annotation", () => {
  it("takes the union it was declared to answer", () => {
    const lines = [
      "fn problemWith(n) -> string | null {",
      "  if n > 1 {",
      '    return "big"',
      "  }",
      "  return null",
      "}",
    ];

    expect(said(...lines)).toEqual([]);
  });

  it("refuses nothing where a value was declared", () => {
    expect(said("fn give() -> string {", "  return null", "}")[0]).toContain(
      "expected string, found null",
    );
  });

  it("refuses a way out the declaration does not allow", () => {
    const lines = [
      "fn problemWith(n) -> string | null {",
      "  if n > 1 {",
      "    return 42",
      "  }",
      "  return null",
      "}",
    ];

    expect(said(...lines)[0]).toContain("VN3010");
  });
});

/** An expression body already answered this, and still answers it the same way. */
describe("the same function written as one expression", () => {
  it("takes a value or nothing", () => {
    const lines = [
      'fn problemWith(n) => n > 1 ? "big" : null',
      "const why: string | null = problemWith(0)",
    ];

    expect(said(...lines)).toEqual([]);
  });
});
