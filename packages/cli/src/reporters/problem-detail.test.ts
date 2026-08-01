import type { Problem } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { problemDetail } from "./problem-detail.js";

const SPAN = { uri: "cart.vn", line: 4, column: 21, offset: 60, length: 7 };

function problem(extra: Partial<Problem> = {}): Problem {
  return {
    code: "VN2018",
    severity: "error",
    title: 'Nothing is named "descnto" here.',
    span: SPAN,
    ...extra,
  };
}

/**
 * §16 says a well-formed error answers seven questions. Two of them arrived.
 *
 * Every check that had something useful to add already added it, into a field
 * the renderer dropped: which import to write, which name was nearly right, why
 * the rule exists. This is where that reaches a person.
 */
describe("what a problem says beneath its title", () => {
  it("says where it happened", () => {
    expect(problemDetail(problem())).toEqual(["  at    cart.vn:4:21"]);
  });

  it("says what to do about it", () => {
    const lines = problemDetail(problem({ help: "Did you mean `desconto`?" }));

    expect(lines).toContain("  help  Did you mean `desconto`?");
  });

  it("says why the rule exists", () => {
    const lines = problemDetail(problem({ note: "A name is bound before it is read." }));

    expect(lines).toContain("  note  A name is bound before it is read.");
  });

  /** "Here it was declared as" is the whole value of a second location. */
  it("says what else is worth looking at, and why", () => {
    const related = [{ span: { ...SPAN, uri: "models.vn", line: 3 }, label: "declared here" }];

    expect(problemDetail(problem({ related }))).toContain("  see   models.vn:3:21  declared here");
  });

  it("says where to read more", () => {
    const lines = problemDetail(problem({ docs: "https://venn.dev/e/VN2018" }));

    expect(lines).toContain("  docs  https://venn.dev/e/VN2018");
  });

  it("asks the questions in the order a person asks them", () => {
    const whole = problem({
      help: "h",
      note: "n",
      docs: "d",
      related: [{ span: SPAN, label: "l" }],
    });

    expect(problemDetail(whole).map((line) => line.trim().split(" ")[0])).toEqual([
      "at",
      "help",
      "note",
      "see",
      "docs",
    ]);
  });

  it("says nothing it was not told", () => {
    expect(problemDetail(problem({ help: "", note: undefined }))).toEqual(["  at    cart.vn:4:21"]);
  });

  /** The tree reporter prints its own location, and twice reads as two places. */
  it("leaves the location out when the caller printed one", () => {
    const lines = problemDetail(problem({ help: "h" }), { indent: "     ", where: false });

    expect(lines).toEqual(["     help  h"]);
  });
});
