import { describe, expect, it } from "vitest";
import { lineStart, placeAt, spanAt } from "./at-an-offset.js";
import { parse } from "./parse.js";

/** The first problem a source earns, as its code and the place a reader reads. */
function pointedAt(source: string): string {
  const [problem] = parse(source).problems;
  return `${problem?.code} ${problem?.span.line}:${problem?.span.column}`;
}

/**
 * Column 1 of line 1, which is the case no fixture covers.
 *
 * Two arithmetics can answer it and they part company here. Reading back from the
 * line start is `offset - lineStart(text, offset) + 1`, and `lastIndexOf` reads a
 * negative `from` as `0`, so at offset `0` it matches the newline a file may open
 * with and answers line 2, column 0. Counting only what precedes the offset
 * cannot: nothing precedes the first character.
 *
 * Line 2 column 0 is not a place. There is no column 0 in a 1-based column, and
 * the offset asked about is the first byte of the file, so the second is right
 * and this holds it.
 */
describe("the first character of a file", () => {
  it("is line 1, column 1", () => {
    expect(placeAt("a += 2\n", 0)).toEqual({ line: 1, column: 1 });
  });

  it("is still line 1, column 1 when the file opens with a newline", () => {
    expect(placeAt("\na += 2\n", 0)).toEqual({ line: 1, column: 1 });
    expect(lineStart("\na += 2\n", 0)).toBe(0);
  });

  /** The character after it is on line 2, which is what makes the row above a claim. */
  it("does not take line 2 with it", () => {
    expect(placeAt("\na += 2\n", 1)).toEqual({ line: 2, column: 1 });
    expect(lineStart("\na += 2\n", 1)).toBe(1);
  });

  /**
   * A mark is a character the file has and no editor draws, so the offset counts
   * it and the column does not. The `a` after one reads as column 1.
   */
  it("does not count a byte-order mark in the column", () => {
    expect(placeAt("\uFEFFa += 2", 1)).toEqual({ line: 1, column: 1 });
  });
});

/**
 * The three numbers a Problem carries, for an explainer that read the text rather
 * than a token and so has no node to ask.
 */
describe("a span read off an offset", () => {
  it("carries the offset and the width it was handed, and places them", () => {
    expect(spanAt({ text: "let a = 1\na += 2", uri: "f.vn", offset: 12, length: 2 })).toEqual({
      uri: "f.vn",
      offset: 12,
      length: 2,
      line: 2,
      column: 3,
    });
  });

  it("places an offset on the last line of a file with no trailing newline", () => {
    expect(placeAt("one\ntwo\nthree", 12)).toEqual({ line: 3, column: 5 });
  });
});

/**
 * The same arithmetic through the explainers that use it, which is the only place
 * a wrong column is visible to a reader.
 */
describe("what an explainer points at", () => {
  it("points at the operator, three characters in", () => {
    expect(pointedAt("let a = 1\na += 2")).toBe("VN1005 2:3");
  });

  it("points at a method spelling that starts in column 1", () => {
    expect(pointedAt("let rows = [1]\nrows.forEach(r => print r)")).toBe("VN5010 2:1");
  });
});
