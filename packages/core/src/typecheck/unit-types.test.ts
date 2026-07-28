import { describe, expect, it } from "vitest";
import type { Document } from "../generated/ast.js";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";
import { showType } from "./show.js";

/** The type of `const a = <source>`, plus whatever the checker complained about. */
function check(source: string): { type: string; problems: string[] } {
  const { ast, problems } = parse(`const a = ${source}\n`);
  expect(problems).toEqual([]);
  const checked = checkTypes(ast as Document);
  const decl = (ast as Document).decls[0] as { value?: object };
  const type = decl.value ? checked.types.get(decl.value) : undefined;
  return {
    type: type ? showType(type) : "?",
    problems: checked.problems.map((problem) => problem.code),
  };
}

describe("units are types", () => {
  it("reads the unit off the literal", () => {
    expect(check("300ms").type).toBe("duration");
    expect(check("123kb").type).toBe("size");
    expect(check("50%").type).toBe("percent");
    expect(check("200").type).toBe("number");
  });

  it("keeps the unit through arithmetic that makes sense", () => {
    expect(check("300ms + 1s").type).toBe("duration");
    expect(check("2mb * 3").type).toBe("size");
    // Dividing a duration by a duration is how many times it fits: a number.
    expect(check("1s / 250ms").type).toBe("number");
  });

  // The rule comes from `combine`, the one the evaluator uses, so the checker
  // and the run can never disagree about what is allowed.
  it("refuses to combine different units, at compile time", () => {
    expect(check("300ms + 2mb").problems).toEqual(["VN3012"]);
    expect(check("300ms < 2mb").problems).toEqual(["VN3012"]);
  });

  it("refuses to add a bare number to a unit", () => {
    expect(check("300ms + 5").problems).toEqual(["VN3012"]);
  });

  it("compares two of the same unit", () => {
    expect(check("300ms < 1s").type).toBe("bool");
    expect(check("300ms < 1s").problems).toEqual([]);
  });

  it("still learns a plain number from an unsolved operand", () => {
    const { ast } = parse("fn double(x) => x * 2\n");
    const checked = checkTypes(ast as Document);
    const decl = (ast as Document).decls[0] as object;

    expect(showType(checked.types.get(decl) as never)).toBe("fn(number) -> number");
    expect(checked.problems).toEqual([]);
  });
});

describe("a number read as a unit", () => {
  it("takes the unit's type", () => {
    expect(check("1500.toMs").type).toBe("duration");
    expect(check("2048.toKb").type).toBe("size");
    expect(check("0.5.toRatio").type).toBe("percent");
  });

  it("then obeys the unit rules", () => {
    expect(check("1500.toMs + 1s").type).toBe("duration");
    expect(check("1500.toMs + 2mb").problems).toEqual(["VN3012"]);
  });
});
