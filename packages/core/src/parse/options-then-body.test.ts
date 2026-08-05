import { describe, expect, it } from "vitest";
import { parse } from "./index.js";

/** The titles reported for a source, which is what a reader sees. */
function titles(source: string): string[] {
  return parse(source).problems.map((problem) => problem.title);
}

/**
 * A header whose body was eaten as its options.
 *
 * The grammar and the specification agree that a trailing `{ … }` after one of
 * these is always its options, so `parallel { workers: 4 }` is a header with
 * options and no body. The parser then asked for the very brace the writer
 * believed they had already written, which is the one message in the language
 * that names a separator as something it found and still explains nothing.
 */
describe("a map after a header, read as options", () => {
  it("says the map was read as options and a body is still wanted", () => {
    expect(titles("parallel { workers: 4 }")[0]).toBe(
      "The `{ … }` after `parallel` was read as its options, not as its body. A body in `{ }` still has to follow it.",
    );
  });

  /** The word is read out of the grammar, so every header of this shape is covered. */
  it.each([
    ["forEach x in [1,2] { limit: 2 }", "forEach"],
    ["race { attempts: 2 }", "race"],
  ])("names the word the construct opens with (%s)", (source, word) => {
    expect(titles(source)[0]).toContain(`after \`${word}\``);
  });

  it("points at the brace that was read as options, not past the end of the file", () => {
    const span = parse("parallel { workers: 4 }").problems[0]?.span;

    expect(`${span?.line}:${span?.column}`).toBe("1:10");
  });

  /** With a body after it the reading is the one the grammar always meant. */
  it("says nothing about the shape when the body is there", () => {
    expect(titles("parallel { workers: 4 } { print 1 }")).toEqual([]);
  });

  /** A brace that is not a map is not options, so it was the body all along. */
  it("says nothing when the brace could never have been options", () => {
    expect(titles("parallel { print 1 }")).toEqual([]);
  });
});
