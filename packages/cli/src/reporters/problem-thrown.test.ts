import { VennError } from "@venn-lang/contracts";
import { describe, expect, it } from "vitest";
import { problemThrown } from "./problem-thrown.js";

/**
 * A failure carrying a code of ours, raised by a `VennError` the reporters
 * cannot recognise by class.
 *
 * `@venn-lang/contracts` ships `.` and `./node` as two bundles, so the binary
 * holds two `VennError` classes and the file system port's failures are built
 * by the copy the reporters did not import. This is that error: same shape,
 * different class. Nothing under vitest reproduces the split, because the
 * `development` condition resolves both entries to one module.
 */
class ForeignVennError extends Error {
  readonly code = "VN8010";
  readonly detail = { path: "orders.csv" };
}

/**
 * The regression this exists for: `print fs.read("nowhere.json")` reached the
 * terminal as a bare `File not found: "x".` with its `VN8010` stripped off,
 * while `print json.parse("{ oops")` on the same binary in the same second kept
 * `VN7003`. The two differ only by which copy of the class built them, which is
 * not a difference a reader should ever be shown.
 */
describe("a code the language catalogued", () => {
  it("survives a failure built by another copy of the class", () => {
    const problem = problemThrown(new ForeignVennError('File not found: "orders.csv".'));

    expect(problem?.code).toBe("VN8010");
    expect(problem?.title).toBe('File not found: "orders.csv".');
    expect(problem?.docs).toBe("https://venn.dev/e/VN8010");
  });

  it("survives one built by the copy that was imported", () => {
    const failure = new VennError({ code: "VN7003", message: "This is not JSON." });

    expect(problemThrown(failure)?.code).toBe("VN7003");
  });
});

/**
 * A stray from below the language has no code of ours to lead with, and an
 * `ENOENT` from Node carries a `code` that is a string all the same. Widening
 * the gate to any string at all would have turned every one of those into a
 * `VN7000` with a note about a code nobody can look up.
 */
describe("a stray from below the language", () => {
  it("is left to be said as the one line it is", () => {
    const enoent = Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" });

    expect(problemThrown(enoent)).toBeUndefined();
    expect(problemThrown(new TypeError("x is not a function"))).toBeUndefined();
  });
});
