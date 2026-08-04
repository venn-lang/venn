import { VennError } from "@venn-lang/contracts";
import { ProblemError } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { errorLine } from "./error-line.js";

const UNREADABLE = {
  code: "VN8010",
  severity: "error",
  title: "The file could not be read: orders.csv",
  span: { uri: "flows/load.vn", line: 7, column: 3, offset: 90, length: 12 },
  help: "Check the path is relative to the flow file.",
} as const;

/**
 * One line for one failure, however it reached us.
 *
 * The one worth holding is the machine's own: a `RangeError` about a call stack
 * names something the program never wrote, and arrived with no code at all.
 */
describe("a failure as one line", () => {
  /**
   * A `VennError` carries most of the runtime's codes, and its shape is the
   * catalogue's: nothing below the language chose `VN7001`, so it leads with it.
   */
  it("leads with the code when the failure carries one", () => {
    const failure = new VennError({ code: "VN7001", message: "The action failed." });

    expect(errorLine(failure)).toBe("VN7001  The action failed.");
  });

  /**
   * The span a `VennError` puts in `detail.where` was dropped, so a failure that
   * knew its own line arrived without one.
   */
  it("says where a carried code says it happened", () => {
    const where = { uri: "flows/checkout.vn", offset: 12, length: 8, line: 2, column: 3 };
    const failure = new VennError({
      code: "VN2003",
      message: "Unknown action.",
      detail: { where },
    });

    expect(errorLine(failure)).toContain("flows/checkout.vn:2:3");
  });

  /**
   * A `ProblemError` is not a `VennError`, so it fell through to `.message`,
   * which its constructor set to the title alone: the code, the span and the
   * help a check had already worked out were built and dropped one line before
   * a person would have read them.
   */
  it("says everything a carried problem knows, not only its title", () => {
    const said = errorLine(new ProblemError(UNREADABLE));

    expect(said).toContain("VN8010");
    expect(said).toContain("The file could not be read: orders.csv");
    expect(said).toContain("flows/load.vn:7:3");
    expect(said).toContain("Check the path is relative to the flow file.");
  });

  it("gives a function that never stops calling itself a code of its own", () => {
    const said = errorLine(new RangeError("Maximum call stack size exceeded"));

    expect(said).toContain("VN8003");
    expect(said).toContain("calls itself");
  });

  /** A range error about something else is not that, and keeps its own words. */
  it("leaves another range error alone", () => {
    expect(errorLine(new RangeError("toFixed() digits argument must be between 0 and 100"))).toBe(
      "toFixed() digits argument must be between 0 and 100",
    );
  });

  it("takes the message off anything else that was thrown", () => {
    expect(errorLine(new Error("something else"))).toBe("something else");
  });

  it("says what it was handed when there is no message at all", () => {
    expect(errorLine("a bare string")).toBe("a bare string");
    expect(errorLine(new Error(""))).toBe("Error");
  });
});
