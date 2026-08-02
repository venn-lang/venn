import { describe, expect, it } from "vitest";
import { ofType } from "./of-type.js";

/**
 * A matcher's message writes a value with the renderer it was handed, so a
 * failure and a `print` of the same value agree. Handed a stand-in here, marked
 * so the test is about the deferring rather than about the text.
 */
const ctx = { log: () => {}, show: (value: unknown) => `<${value}>` };

describe("what `ofType` says when it fails", () => {
  it("writes the argument through the renderer it was handed", () => {
    const said = ofType.message({ subject: {}, args: ["ping"], params: {} } as never, ctx as never);

    expect(said).toContain("<ping>");
  });
});
