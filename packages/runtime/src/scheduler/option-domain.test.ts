import type { ParamSpec } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { outsideItsDomain } from "./option-domain.js";

/**
 * One sentence per way an option can be wrong, asked here rather than through a
 * program, because the checker and the runtime both ask it and a reader must get
 * the same words whether the value was written down or came out of a variable.
 */
const CHOICE: ParamSpec = {
  name: "onError",
  type: "string",
  required: false,
  values: ["stop", "collect"],
};
const COUNT: ParamSpec = { name: "concurrency", type: "number", required: false };
const TIME: ParamSpec = { name: "timeout", type: "duration", required: false };
const ANYTHING: ParamSpec = { name: "label", type: "string", required: false };

describe("an option that was not written", () => {
  it("is not wrong, because a default is the answer to a missing value", () => {
    expect(outsideItsDomain(COUNT, undefined)).toBeUndefined();
  });
});

describe("an option with a list of accepted words", () => {
  it("takes one of them", () => {
    expect(outsideItsDomain(CHOICE, "collect")).toBeUndefined();
  });

  it("names the others when the word is not one of them", () => {
    expect(outsideItsDomain(CHOICE, "collct")).toContain("Accepted: stop, collect.");
  });
});

describe("an option that counts", () => {
  it("refuses a quoted number, which is what an environment variable looks like", () => {
    expect(outsideItsDomain(COUNT, "3")).toBe("concurrency needs a number, and this is a string.");
  });

  it("takes a number", () => {
    expect(outsideItsDomain(COUNT, 3)).toBeUndefined();
  });
});

describe("an option that is a length of time", () => {
  it("takes a duration", () => {
    expect(outsideItsDomain(TIME, { kind: "duration", ms: 40 })).toBeUndefined();
  });

  it("says what a length of time looks like when it is given something else", () => {
    expect(outsideItsDomain(TIME, "soon")).toContain("needs a length of time, as in 10s");
  });
});

describe("an option with no domain to hold it to", () => {
  it("takes whatever it is given, since nothing declared what it accepts", () => {
    expect(outsideItsDomain(ANYTHING, 42)).toBeUndefined();
  });
});
