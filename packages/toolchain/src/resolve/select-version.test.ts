import { describe, expect, it } from "vitest";
import type { VersionRequest } from "./resolve.types.js";
import { isUsableRange, selectVersion } from "./select-version.js";

const INSTALLED = ["0.1.3", "0.2.0", "0.2.4", "1.0.0", "1.4.2", "2.0.0"];

function asked(range: string): VersionRequest {
  return { range, source: "manifest", from: "/work/venn.toml" };
}

function chosen(range: string, installed: readonly string[] = INSTALLED): string | undefined {
  return selectVersion({ request: asked(range), installed }).version;
}

describe("choosing which installed version answers", () => {
  it("takes an exact version as exactly that", () => {
    expect(chosen("0.2.0")).toBe("0.2.0");
  });

  /** The point of a range: move within it without editing the pin. */
  it("takes the newest of a patch range", () => {
    expect(chosen("0.2.x")).toBe("0.2.4");
    expect(chosen("0.2")).toBe("0.2.4");
    expect(chosen("~0.2.0")).toBe("0.2.4");
  });

  it("takes the newest of a major range", () => {
    expect(chosen("1.x")).toBe("1.4.2");
    expect(chosen("1.x.x")).toBe("1.4.2");
    expect(chosen("^1.0.0")).toBe("1.4.2");
  });

  it("reads a comparator, and two of them as a window", () => {
    expect(chosen(">=1")).toBe("2.0.0");
    expect(chosen(">=1 <1.5")).toBe("1.4.2");
    expect(chosen("<1")).toBe("0.2.4");
  });

  it("answers anything with the newest there is", () => {
    expect(chosen("*")).toBe("2.0.0");
  });

  /**
   * Never an arbitrary match. Pinning `0.2` and getting `0.2.1` one day and
   * `0.2.4` the next would make a pin worse than no pin at all.
   */
  it("always takes the newest that matches, never any that matches", () => {
    const choice = selectVersion({ request: asked("0.2.x"), installed: INSTALLED });

    expect(choice.version).toBe("0.2.4");
    expect(choice.candidates).toEqual(["0.2.4", "0.2.0"]);
  });

  it("says nothing matched, and what was there instead", () => {
    const choice = selectVersion({ request: asked("3.x"), installed: INSTALLED });

    expect(choice.version).toBeUndefined();
    expect(choice.candidates).toEqual([]);
  });

  it("has nothing to choose from when nothing is installed", () => {
    expect(chosen("*", [])).toBeUndefined();
  });
});

describe("a prerelease", () => {
  const withRc = ["1.4.2", "1.5.0-rc.1"];

  /** Running on a release candidate is a decision, not something to fall into. */
  it("does not answer a range that did not ask for one", () => {
    expect(chosen("1.x", withRc)).toBe("1.4.2");
    expect(chosen(">=1", withRc)).toBe("1.4.2");
    expect(chosen("*", withRc)).toBe("1.4.2");
  });

  it("answers when it is asked for by name", () => {
    expect(chosen("1.5.0-rc.1", withRc)).toBe("1.5.0-rc.1");
  });
});

describe("a range that means nothing", () => {
  it("matches nothing rather than throwing", () => {
    expect(chosen("not a version")).toBeUndefined();
  });

  it("can be recognised before it is written down", () => {
    expect(isUsableRange("0.2.x")).toBe(true);
    expect(isUsableRange(">=1 <1.5")).toBe(true);
    expect(isUsableRange("*")).toBe(true);
    expect(isUsableRange("not a version")).toBe(false);
    expect(isUsableRange("")).toBe(true);
  });
});

describe("what is installed", () => {
  it("ignores an entry that is not a version, rather than tripping on it", () => {
    expect(chosen("*", ["1.0.0", "not-a-version", ".DS_Store", "2.0.0"])).toBe("2.0.0");
  });
});
