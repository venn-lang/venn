import { describe, expect, it } from "vitest";
import { parseExpression } from "../../parse/index.js";
import type { EvalEnv } from "../eval-env.types.js";
import { evaluate } from "../evaluate.js";

const env: EvalEnv = { lookup: () => undefined };

/** Evaluate one expression, the way a line of a program would. */
function run(expr: string): unknown {
  const parsed = parseExpression(expr);
  if (!parsed) throw new Error(`could not parse: ${expr}`);
  return evaluate(parsed, env);
}

/** The code and the title of whatever the expression refused with. */
function refusal(expr: string): { code: string; title: string } {
  try {
    run(expr);
  } catch (thrown) {
    const problem = (thrown as { problem: { code: string; title: string } }).problem;
    return { code: problem.code, title: problem.title };
  }
  throw new Error(`${expr} answered instead of refusing`);
}

/**
 * The three steps that took `--top abc` to a report with no rows and exit 0.
 * Each one used to answer, and the answer poisoned the next.
 */
describe("the bad number that shipped", () => {
  it("refuses text that is not a number instead of answering NaN", () => {
    expect(refusal('"abc".toNumber')).toEqual({
      code: "VN3016",
      title: '"abc" is not a number.',
    });
  });

  it("refuses at the conversion, so the count is never reached", () => {
    expect(refusal('[1, 2, 3].take("abc".toNumber)').code).toBe("VN3016");
  });

  it("still reads text that is a number", () => {
    expect(run('"42".toNumber')).toBe(42);
    expect(run('" 42 ".toNumber')).toBe(42);
    expect(run('"-2.5".toNumber')).toBe(-2.5);
  });

  it("refuses the empty string and the infinities, which are not numbers either", () => {
    expect(refusal('"".toNumber').code).toBe("VN3016");
    expect(refusal('"Infinity".toNumber').code).toBe("VN3016");
  });

  /**
   * The help line is a claim, and the claim is that this compiles and answers.
   * Run in the argument position that earns it, not on its own, because a
   * rewrite that crosses into a call is where one stops fitting.
   */
  it("answers when the reader takes the way out the help names", () => {
    expect(run('try "abc".toNumber else 0')).toBe(0);
    expect(run('[1, 2, 3].take(try "abc".toNumber else 0)')).toEqual([]);
    expect(run('try "42".toNumber else 0')).toBe(42);
  });
});

describe("arithmetic with no answer", () => {
  it("refuses a divisor of zero rather than answering an infinity", () => {
    expect(refusal("1 / 0")).toEqual({
      code: "VN3030",
      title: "Dividing by zero has no quotient.",
    });
  });

  it("refuses it for the remainder too, and says which", () => {
    expect(refusal("5 % 0").title).toBe("Dividing by zero has no remainder.");
  });

  it("refuses zero over zero, which used to be the not-a-number", () => {
    expect(refusal("0 / 0").code).toBe("VN3030");
  });

  // The fast path in the compiler only takes two plain numbers, so a unit has
  // to be asked separately or it keeps dividing by zero on the slow one.
  it("refuses a unit divided by zero, on the path units take", () => {
    expect(refusal("300ms / 0").code).toBe("VN3030");
    expect(refusal("300ms / 0s").code).toBe("VN3030");
  });

  it("leaves every divisor that is not zero alone", () => {
    expect(run("7 / 2")).toBe(3.5);
    expect(run("7 % 2")).toBe(1);
    expect(run("-1 / 4")).toBe(-0.25);
  });

  it("refuses the root of a negative and the power with no answer", () => {
    expect(refusal("(-4).sqrt").title).toBe("There is no square root of -4.");
    expect(refusal("(0).pow(-1)").code).toBe("VN3030");
  });

  it("leaves the roots and powers that have one", () => {
    expect(run("(16).sqrt")).toBe(4);
    expect(run("(2).pow(0.5)")).toBeCloseTo(1.4142135);
    expect(run("(2).pow(-1)")).toBe(0.5);
  });

  /**
   * `try` and not a guard block, and this is what pins that choice. A binding
   * declared inside `if b != 0 { … }` is out of scope on the line that reads
   * it, so that rewrite answered `null` and exit 0: the diagnostic for a silent
   * wrong answer producing one. `try` stands where the division stands.
   */
  it("answers when the reader takes the way out the help names", () => {
    expect(run("try 1 / 0 else 0")).toBe(0);
    expect(run("try 5 % 0 else 0")).toBe(0);
    expect(run("(-4).abs.sqrt")).toBe(2);
    expect(run("try [].average else 0")).toBe(0);
  });
});

describe("a count that is not one", () => {
  it("refuses a negative count and names the range", () => {
    expect(refusal("[1, 2, 3].take(-1)")).toEqual({
      code: "VN3031",
      title: "`take` needs a count of 0 or more, and this is -1.",
    });
  });

  it("refuses a fraction, because there is no half an item", () => {
    expect(refusal("[1, 2, 3].take(1.5)").title).toBe(
      "`take` needs a whole count, and this is 1.5.",
    );
  });

  it("refuses the same way for the other three that count", () => {
    for (const verb of ["drop", "takeLast", "dropLast"]) {
      expect(refusal(`[1, 2, 3].${verb}(-1)`).code).toBe("VN3031");
    }
  });

  it("refuses a chunk of nothing, which used to become a chunk of one", () => {
    expect(refusal("[1, 2, 3].chunk(0)").title).toBe(
      "`chunk` needs a chunk size of 1 or more, and this is 0.",
    );
    expect(refusal("[1, 2, 3].windows(0)").code).toBe("VN3031");
  });

  it("leaves the counts that are counts", () => {
    expect(run("[1, 2, 3].take(0)")).toEqual([]);
    expect(run("[1, 2, 3].take(2)")).toEqual([1, 2]);
    expect(run("[1, 2, 3].take(99)")).toEqual([1, 2, 3]);
    expect(run("[1, 2, 3].chunk(2)")).toEqual([[1, 2], [3]]);
  });

  it("refuses a width and a repeat below zero", () => {
    expect(refusal('"x".padStart(-5)').code).toBe("VN3031");
    expect(refusal('"x".repeat(-1)').code).toBe("VN3031");
  });

  it("refuses decimal places outside what can be rendered", () => {
    expect(refusal("(2.5).round(-1)").title).toBe(
      "`round` needs a number of decimal places between 0 and 20, and this is -1.",
    );
    expect(refusal("(2.5).toFixed(21)").code).toBe("VN3031");
  });

  it("refuses bounds that hold nothing", () => {
    expect(refusal("(5).clamp(10, 1)").title).toBe(
      "`clamp` needs its low bound at or below its high bound, and this is 10 and 1.",
    );
    expect(run("(5).clamp(1, 10)")).toBe(5);
  });

  /** Every spelling these refusals name, run against the line that earns it. */
  it("answers when the reader takes the way out the help names", () => {
    expect(run("[1, 2, 3].take((3 / 2).floor)")).toEqual([1]);
    expect(run("[1, 2, 3].chunk(1)")).toEqual([[1], [2], [3]]);
  });
});

describe("a position that is not one", () => {
  /** Past the end is absence and stays null; before the start is a mistake. */
  it("keeps a read past the end as nothing", () => {
    expect(run("[1, 2, 3][99]")).toBeNull();
    expect(run('{ a: 1 }.get("nope")')).toBeNull();
  });

  it("refuses a position before the start", () => {
    expect(refusal("[1, 2, 3][-1]")).toEqual({
      code: "VN3031",
      title: "There is no position -1.",
    });
  });

  it("refuses a position between two, on a list and on a string alike", () => {
    expect(refusal("[1, 2, 3][1.5]").code).toBe("VN3031");
    expect(refusal('"abc"[-1]').code).toBe("VN3031");
  });

  it("refuses a slice that starts before the start, and keeps the clamping", () => {
    expect(refusal("[1, 2, 3].slice(-2)").code).toBe("VN3031");
    expect(run("[1, 2, 3].slice(99, 5)")).toEqual([]);
    expect(run("[1, 2, 3].slice(1, 99)")).toEqual([2, 3]);
  });

  /** The two members the position refusal names, on the list that earns it. */
  it("answers when the reader takes the way out the help names", () => {
    expect(run("[1, 2, 3].last")).toBe(3);
    expect(run("[1, 2, 3].takeLast(1)")).toEqual([3]);
  });
});

describe("what stays total on purpose", () => {
  /**
   * Zipping two lists of different lengths is the ordinary case, not the
   * mistake, and four other languages answer the overlap. The list is a whole
   * answer to "what do these two have in common by position".
   */
  it("zips to the shorter without complaint", () => {
    expect(run('[1, 2, 3].zip(["a"])')).toEqual([[1, "a"]]);
  });

  it("sums nothing to zero, which is what the sum of nothing is", () => {
    expect(run("[].sum")).toBe(0);
  });

  it("still answers nothing for the extreme of nothing", () => {
    expect(run("[].min")).toBeNull();
    expect(run("[].max")).toBeNull();
  });

  it("refuses to add up something that is not a number", () => {
    expect(refusal('["a", "b"].sum').title).toBe("`sum` needs a number, and this is a string.");
  });
});
