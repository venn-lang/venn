// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Venn source under test.
import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";

/** Type-check a program and return its error codes + titles. */
function check(source: string): string[] {
  const { ast } = parse(source);
  return checkTypes(ast).problems.map((p) => `${p.code} ${p.title}`);
}

describe("type inference", () => {
  it("accepts sound arithmetic and comparisons", () => {
    expect(check("const a = 1 + 2 * 3\nconst b = a > 5")).toEqual([]);
  });

  it("names the join, and not the two types, when `+` meets a string", () => {
    const errors = check("const x = 1 + 'oops'");
    expect(errors).toEqual(["VN3024 `+` adds numbers; it does not join strings."]);
  });

  it("infers a function's parameter and return types from its body", () => {
    // double(x) forces x:number by `x * 2`; calling it with a string is an error.
    expect(check("fn double(x) => x * 2\nconst n = double(3)")).toEqual([]);
    expect(check("fn double(x) => x * 2\nconst n = double('no')")[0]).toContain("VN3010");
  });

  it("is generic: one identity function serves every type", () => {
    const source = "fn id(x) => x\nconst a = id(1)\nconst b = id('two')\nconst c = id(true)";
    expect(check(source)).toEqual([]);
  });

  it("checks list methods through their element type", () => {
    expect(check("const xs = [1, 2, 3]\nconst ys = xs.map(fn (n) => n > 0)")).toEqual([]);
    // `trim` is a string's, so reading it off `s` is only wrong if `s` is known
    // to be the number the list holds, which is what this asks.
    expect(
      check("const xs = [1, 2, 3]\nconst bad = xs.map(fn (n) => n).filter(fn (s) => s.trim)")[0],
    ).toContain("VN3010");
  });

  it("catches a wrong field on a known record", () => {
    const errors = check("const p = { name: 'Ada', age: 36 }\nconst n = p.naem");
    expect(errors[0]).toContain("VN3010");
    expect(errors[0]).toContain("naem");
  });

  it("reads a real field on a record without complaint", () => {
    expect(
      check("const p = { name: 'Ada', age: 36 }\nconst n = p.name\nconst a = p.age + 1"),
    ).toEqual([]);
  });

  it("leaves the dynamic world alone, a plugin result never errors", () => {
    // `http.get` and `res` are unknown to the checker, so they are dynamic.
    expect(check("const res = http.get 'https://x'\nconst n = res.status + 1")).toEqual([]);
  });

  it("respects a written return-type annotation", () => {
    // The body is a number (`n * 2`), so a `-> string` return is a mismatch.
    expect(check("fn label(n) -> string { n * 2 }")[0]).toContain("VN3010");
    expect(check("fn label(n) -> number { n * 2 }")).toEqual([]);
  });

  it("checks types inside string interpolation", () => {
    // Reported at all is the point; a `+` reaching for a join inside a `${…}`
    // is answered by the same sentence it gets anywhere else.
    expect(check("const x = 1\nconst s = \"${x + 'no'}\"")[0]).toContain("VN3024");
  });
});
