import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";

function problems(source: string): string[] {
  return checkTypes(parse(source).ast).problems.map((problem) => problem.title);
}

/**
 * Reading a member a type does not have.
 *
 * A string, a list and a handle publish their whole member set, so there is no
 * shape they could turn out to have later and nothing for silence to protect.
 * Answering `dynamic` there lets the line type-check and then read as nothing at
 * run time, with the editor and the checker agreeing about something untrue.
 */
describe("a member the type does not have", () => {
  it("says so for a string", () => {
    expect(problems('const s = "a".naoExiste')).toEqual(['Type string has no member "naoExiste".']);
  });

  it("says so for a list", () => {
    expect(problems("const s = [1, 2].naoExiste")).toEqual([
      'Type list<number> has no member "naoExiste".',
    ]);
  });

  /** Named now, which is what the reader called it everywhere else in the file. */
  it("says so for a map, as it always did", () => {
    const source = ["type P { id: number }", "const p: P = { id: 1 }", "const s = p.naoExiste"];

    expect(problems(source.join("\n"))).toEqual(['Type P has no field "naoExiste".']);
  });

  /** A map nobody named still shows its shape, since that is all it has. */
  it("says so for a map with no name of its own", () => {
    const source = ["const p = { id: 1 }", "const s = p.naoExiste"];

    expect(problems(source.join("\n"))).toEqual(['Type { id: number } has no field "naoExiste".']);
  });

  it("keeps quiet about the members those types do have", () => {
    expect(problems('const a = "x".upper\nconst b = [1].len\nconst c = 300ms.seconds')).toEqual([]);
  });

  /** The escape hatch stays an escape hatch: `dynamic` promises nothing. */
  it("keeps quiet about dynamic", () => {
    const source = ["fn qualquer(x: dynamic) => x.seja.o.que.for"];

    expect(problems(source.join("\n"))).toEqual([]);
  });

  /** An unwritten parameter is not yet a type: saying no here would be a guess. */
  it("keeps quiet about a type still unsolved", () => {
    expect(problems("fn ler(x) => x.qualquerCoisa")).toEqual([]);
  });
});
