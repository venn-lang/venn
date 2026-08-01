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
const USER = ["type User = { name: string | null }", 'const u: User = { name: "ana" }'];

function withUser(...lines: string[]): string {
  return [...USER, ...lines].join(NEWLINE);
}

/**
 * What the three logical operators are worth.
 *
 * All three hand back an operand rather than a verdict, and two of them take
 * the nothing away. Typing them as `bool` refused lines that run, and leaving
 * the null in made `??` look like it changed no type at all.
 */
describe("the type of a coalescing", () => {
  it("is the left side without the nothing it may be", () => {
    expect(said(withUser('const name: string = u.name ?? "anon"'))).toEqual([]);
  });

  it("is refused where neither side fits", () => {
    const said_ = said(withUser('const n: number = u.name ?? "anon"'));

    expect(said_[0]).toContain("VN3010");
  });

  it("keeps both sides when they differ", () => {
    expect(said(withUser("const either: string | number = u.name ?? 8080"))).toEqual([]);
  });

  it("is the right side when the left is only nothing", () => {
    expect(said("const port: number = null ?? 8080")).toEqual([]);
  });

  /** The fallback is unreachable, so it decides nothing about the type. */
  it("is the left side alone when it cannot be nothing", () => {
    expect(said('const greeting: string = "hi" ?? 8080')).toEqual([]);
  });
});

describe("the type of an and, and of an or", () => {
  it("is what they hand back, not a verdict", () => {
    expect(said(withUser('const name: string = u.name || "anon"'))).toEqual([]);
    expect(said(withUser('const shown: string = "here" && "second"'))).toEqual([]);
  });

  /** `&&` gives back the falsy left, and nothing is one of the things it may be. */
  it("keeps the nothing an and may give back", () => {
    expect(said(withUser("const maybe: string | null = u.name && u.name"))).toEqual([]);
  });

  it("still reads as a condition", () => {
    const source = withUser("if u.name != null && true {", "  print u.name", "}");

    expect(said(source)).toEqual([]);
  });
});
