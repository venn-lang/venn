import { describe, expect, it } from "vitest";
import { joinTemplate, stringifyValue } from "./join-template.js";

describe("how a filled placeholder reads", () => {
  it("writes a string as it is", () => {
    expect(stringifyValue("ana")).toBe("ana");
  });

  it("writes a number, a boolean and a list the way the language prints them", () => {
    expect(stringifyValue(42)).toBe("42");
    expect(stringifyValue(true)).toBe("true");
    expect(stringifyValue([1, 2])).toBe("1,2");
  });

  /** Nothing at all, since `add ` reads better than `add null`. */
  it("writes nothing for an absent value", () => {
    expect(stringifyValue(null)).toBe("");
    expect(stringifyValue(undefined)).toBe("");
  });

  it("keeps the unit on a value that carries one", () => {
    expect(stringifyValue({ kind: "duration", ms: 300 })).toBe("300ms");
    expect(stringifyValue({ kind: "size", bytes: 2048 })).toBe("2048b");
    expect(stringifyValue({ kind: "percent", ratio: 0.5 })).toBe("50%");
  });
});

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
