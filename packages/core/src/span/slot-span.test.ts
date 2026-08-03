import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import type { Problem } from "../problem/index.js";
import { checkTypes } from "../typecheck/index.js";

const NEWLINE = String.fromCharCode(10);
const URI = "memory://slot.vn";

function problemsIn(...lines: readonly string[]): Problem[] {
  const { ast } = parse(lines.join(NEWLINE), { uri: URI });
  return checkTypes(ast, { uri: URI }).problems;
}

/** Where the placeholder sits, as a reader would count it. */
function at(problem: Problem | undefined): string {
  return problem ? `${problem.span.line}:${problem.span.column}` : "nowhere";
}

/**
 * A slot is parsed as its own little document, and for a long time it was
 * reported as one: every error inside a `${…}` landed at line 1, column 30,
 * whatever the file said, because 30 is where the wrapper puts the first
 * character.
 */
describe("an error inside a placeholder", () => {
  it("is reported at the placeholder, not at the wrapper it was parsed in", () => {
    const found = problemsIn("const xs = [1, 2, 3]", 'print "a"', 'print "sorted is ${xs.sorted}"');

    expect(found.map(at)).toEqual(["3:20"]);
  });

  it("tells two placeholders in one string apart", () => {
    const found = problemsIn("const xs = [1, 2, 3]", 'print "${xs.aaa} and ${xs.bbb}"');

    expect(found.map(at)).toEqual(["2:10", "2:24"]);
  });

  it("counts the lines a multi-line string crosses", () => {
    const found = problemsIn("const xs = [1, 2, 3]", 'print "one', "two", 'three ${xs.zzz}"');

    expect(found.map(at)).toEqual(["4:9"]);
  });

  it("leaves an error outside a string exactly where it was", () => {
    const found = problemsIn("const xs = [1, 2, 3]", "print xs.nope");

    expect(found.map(at)).toEqual(["2:7"]);
  });
});
