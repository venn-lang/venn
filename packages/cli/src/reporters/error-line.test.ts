import { VennError } from "@venn-lang/contracts";
import { describe, expect, it } from "vitest";
import { errorLine } from "./error-line.js";

/**
 * One line for one failure, however it reached us.
 *
 * The one worth holding is the machine's own: a `RangeError` about a call stack
 * names something the program never wrote, and arrived with no code at all.
 */
describe("a failure as one line", () => {
  it("leads with the code when the failure carries one", () => {
    const failure = new VennError({ code: "VN7001", message: "The action failed." });

    expect(errorLine(failure)).toBe("VN7001  The action failed.");
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
