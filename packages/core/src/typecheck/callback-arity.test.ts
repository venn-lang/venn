import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";

/** Type-check a program and return its error codes + titles. */
function check(source: string): string[] {
  const { ast } = parse(source);
  return checkTypes(ast).problems.map((problem) => `${problem.code} ${problem.title}`);
}

const PEOPLE = 'const people = [{ name: "Ada", age: 36 }]\n';

/**
 * A list hands its callback the index alongside the item, and always has. The
 * callback is free to take only the item, which is what nearly every one does.
 */
describe("callbacks that ignore what they are handed", () => {
  it("takes the item alone", () => {
    expect(check(`${PEOPLE}const ages = people.map(p => p.age)`)).toEqual([]);
  });

  it("takes the index too, when it wants it", () => {
    expect(check(`${PEOPLE}const rows = people.map((p, at) => at)`)).toEqual([]);
    expect(check("const n = [1, 2].reduce((total, x, at) => total + x + at, 0)")).toEqual([]);
  });

  it("still types the item it did take", () => {
    const errors = check(`${PEOPLE}const bad = people.map((p, at) => p.age + "x")`);

    expect(errors[0]).toContain("VN3010");
  });

  it("refuses to take more than it is handed", () => {
    const errors = check(`${PEOPLE}const bad = people.map((p, at, extra) => p.age)`);

    expect(errors.length).toBeGreaterThan(0);
  });

  it("leaves ordinary arity alone", () => {
    expect(check("fn double(x) => x * 2\nconst n = double(3, 4)").length).toBeGreaterThan(0);
  });
});
