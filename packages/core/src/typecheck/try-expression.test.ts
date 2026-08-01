import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";

/** Check a program and return what it reported, code and all. */
function said(source: string): string[] {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  return checkTypes(ast).problems.map((problem) => `${problem.code} ${problem.title}`);
}

const NEWLINE = String.fromCharCode(10);

/**
 * What a `try` expression is worth.
 *
 * Either side may be the value, so the type is both. Neither is asked to agree
 * with the other: a fallback is what stands in when the attempt did not happen,
 * and requiring them to match would refuse `try f() else null`, which is the
 * everyday one.
 */
describe("the type of a try expression", () => {
  it("takes both sides, so either may be assigned", () => {
    const source = [
      "fn read(text: string) -> number { return 1 }",
      "const n: number | null = try read(text) else null",
      'const text = "x"',
    ].join(NEWLINE);

    expect(said(source)).toEqual([]);
  });

  it("is the attempt when both sides agree", () => {
    const source = [
      "fn read(text: string) -> number { return 1 }",
      'const n: number = try read("x") else 8080',
    ].join(NEWLINE);

    expect(said(source)).toEqual([]);
  });

  it("refuses what neither side can be", () => {
    const source = [
      "fn read(text: string) -> number { return 1 }",
      'const n: string = try read("x") else 8080',
    ].join(NEWLINE);

    expect(said(source)[0]).toContain("VN3010");
  });

  /** Whatever §16 settles the failure to be, it is not the checker's to guess. */
  it("lets the fallback read the failure it named", () => {
    const source = [
      "fn read(text: string) -> number { return 1 }",
      'const why: string = try read("x") catch e => e.message',
    ].join(NEWLINE);

    expect(said(source)).toEqual([]);
  });

  it("still checks inside the attempt", () => {
    const source = [
      "fn read(text: string) -> number { return 1 }",
      "const n = try read(42) else 0",
    ].join(NEWLINE);

    expect(said(source)[0]).toContain("VN3010");
  });
});
