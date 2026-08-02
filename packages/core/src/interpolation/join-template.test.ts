import { describe, expect, it } from "vitest";
import { joinTemplate } from "./join-template.js";

describe("joining the text around the placeholders", () => {
  it("puts each value between the chunks that surround it", () => {
    expect(joinTemplate(["a ", " b ", " c"], [1, 2])).toBe("a 1 b 2 c");
  });

  it("is the text itself when there is nothing to fill", () => {
    expect(joinTemplate(["plain"], [])).toBe("plain");
  });

  /**
   * `compileTemplate` always gives one chunk more than there are holes, so this
   * cannot arrive from the compiler. It is exported, though, and a caller that
   * counts wrong should get the values rather than `undefined` in the text.
   */
  it("holds up when given fewer chunks than values", () => {
    expect(joinTemplate([], ["a", "b"])).toBe("ab");
  });
});
