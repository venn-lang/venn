import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";

/** Type-check a program and return the titles reported. */
function titles(source: string): string[] {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  return checkTypes(ast).problems.map((problem) => problem.title);
}

describe("the types a loop carries", () => {
  it("says nothing about a loop with no state", () => {
    expect(titles("loop {\n  break\n}")).toEqual([]);
  });

  it("checks the condition like any expression", () => {
    const said = titles(
      'fn takesNumber(n: number) -> number => n\nloop takesNumber("x") > 0 {\n  break\n}',
    );

    expect(said[0]).toContain("Type mismatch");
  });

  /** The state's type comes from what it starts as, and holds through the loop. */
  it("gives the carried name the type of its initial value", () => {
    const source = `fn takesString(s: string) -> string => s
loop total = 0 {
  print takesString(total)
  break
}`;

    expect(titles(source)[0]).toContain("Type mismatch");
  });

  it("accepts the carried name used as what it is", () => {
    const source = `fn takesNumber(n: number) -> number => n
loop total = 0 {
  print takesNumber(total)
  break
}`;

    expect(titles(source)).toEqual([]);
  });

  it("carries a shape, and checks a field read against it", () => {
    const source = `loop state = { at: 0 } {
  print state.missing
  break
}`;

    expect(titles(source)[0]).toContain('has no field "missing"');
  });

  /** The name outlives the loop, so what it holds is checked after it too. */
  it("keeps the carried name in scope after the loop", () => {
    const source = `fn takesString(s: string) -> string => s
loop total = 0 {
  break
}
print takesString(total)`;

    expect(titles(source)[0]).toContain("Type mismatch");
  });
});
