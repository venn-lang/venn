import { describe, expect, it } from "vitest";
import { quoteInASlot } from "./quote-in-a-slot.js";

/**
 * A `.vn` file is library input, so a scan over it has to cost what the file
 * costs. Driving the literal walk with a global regex alone is quadratic on a
 * file whose quotes do not pair: each failed start rescans the tail, so a run of
 * `\"` costs one scan per quote. CodeQL reported it as a polynomial denial of
 * service, and it is: forty thousand escaped quotes took over a second.
 */
describe("the walk over a file's literals", () => {
  it("costs what the file costs, on quotes that never pair", () => {
    const hostile = `\${${'"'}${'\\"'.repeat(40_000)}`;

    // `Date.now` rather than `process.hrtime`, because `core` has no `node`
    // types and must not gain them for a test. The gap being measured is three
    // orders of magnitude, so a millisecond clock is more than enough.
    const began = Date.now();
    quoteInASlot({ text: hostile, uri: "memory://hostile.vn" });
    const took = Date.now() - began;
    expect(took).toBeLessThan(200);
  });

  /**
   * Stopping at the unclosed literal is what makes the walk linear, so the
   * literals before it must still be read. Here the first string closes and
   * carries the mistake; the second opens and never closes.
   */
  it("still reports a cut-short string written before an unclosed one", () => {
    const source = ['print "k ${m["a"]}"', 'print "and then'].join("\n");

    expect(quoteInASlot({ text: source, uri: "memory://x.vn" }).map((one) => one.code)).toEqual([
      "VN1004",
    ]);
  });

  /** Nothing after the unclosed literal is read, because it is all inside it. */
  it("says nothing about a placeholder inside a literal nothing closes", () => {
    const source = ['print "opens here', 'print "k ${m["a"]}"'].join("\n");

    expect(quoteInASlot({ text: source, uri: "memory://x.vn" })).toEqual([]);
  });
});
