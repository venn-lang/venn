import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";

/** The help under the first problem, which is where the way out is written. */
function help(source: string): string | undefined {
  const { ast } = parse(source);
  return checkTypes(ast).problems[0]?.help;
}

/**
 * VN3010 held the receiver's whole member table and offered none of it, while
 * VN2003 had been saying ``Did you mean `io.readLine`?`` for verbs since the
 * suggester was written. Same search, imported rather than written twice.
 *
 * Two answers, certain before fuzzy. A name that exists on another type is not
 * a typo, and saying where it lives beats guessing at what else it could be.
 */
describe("a member the receiver does not have", () => {
  it("offers the nearest name it does have", () => {
    expect(help("let xs = [1, 2, 3]\nprint xs.lenght")).toBe("Did you mean `len`?");
    expect(help('let s = "a"\nprint s.uppr')).toBe("Did you mean `upper`?");
  });

  /**
   * `length` is three edits from `len` on a six-letter word, which is the half
   * the search refuses and is right to refuse in general. It is not a typo: it
   * is the longer word for the same idea, and `len` being the whole of how it
   * begins is what says so.
   */
  it("offers the short name behind a longer one written out", () => {
    expect(help("let args = [1]\nprint args.length")).toBe("Did you mean `len`?");
    expect(help('let s = "a"\nprint s.toNumberValue')).toBe("Did you mean `toNumber`?");
  });

  it("says where a name that exists somewhere else does live", () => {
    expect(help('print "a".concat("b")')).toBe("`concat` is a member of a list, not of a string.");
    expect(help("let n = 1\nprint n.min(2)")).toBe("`min` is a member of a list, not of a number.");
  });

  it("suggests a field the shape does carry", () => {
    expect(help("let p = { name: 'Ada', age: 36 }\nprint p.nam")).toBe("Did you mean `name`?");
  });

  /** A guess nobody can stand behind is worse than the title on its own. */
  it("says nothing when nothing is close", () => {
    expect(help("let xs = [1]\nprint xs.banana")).toBeUndefined();
  });

  it("leaves a member that exists alone", () => {
    const { ast } = parse("let xs = [1, 2, 3]\nprint xs.len");

    expect(checkTypes(ast).problems).toEqual([]);
  });
});
