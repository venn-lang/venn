import { describe, expect, it } from "vitest";
import { ancestorsOf, normalisePath, parentDirOf } from "./up-to-the-root.js";

describe("spelling a path one way", () => {
  it("keeps the slash a root needs and drops the one it does not", () => {
    expect(normalisePath("C:\\work\\api\\")).toBe("C:/work/api");
    expect(normalisePath("c:")).toBe("c:/");
    expect(normalisePath("c:/")).toBe("c:/");
    expect(normalisePath("/")).toBe("/");
    expect(normalisePath("")).toBe("");
  });
});

describe("where an upward walk stops on a drive", () => {
  it("ends at the drive root instead of walking off it", () => {
    expect(parentDirOf("c:/a")).toBe("c:/");
    expect(parentDirOf("c:/")).toBeUndefined();
    expect(parentDirOf("c:")).toBeUndefined();
    expect(ancestorsOf("c:/a/b")).toEqual(["c:/a/b", "c:/a", "c:/"]);
  });
});

describe("where an upward walk stops on unix", () => {
  it("ends at the root the same way", () => {
    expect(parentDirOf("/a")).toBe("/");
    expect(parentDirOf("/")).toBeUndefined();
    expect(ancestorsOf("/a/b")).toEqual(["/a/b", "/a", "/"]);
  });
});

/** The empty string is the directory a relative path was written against. */
describe("where a relative walk stops", () => {
  it("ends at the place the path was written against", () => {
    expect(parentDirOf("packages/api")).toBe("packages");
    expect(parentDirOf("packages")).toBe("");
    expect(parentDirOf("")).toBeUndefined();
    expect(ancestorsOf("packages/api/src")).toEqual(RELATIVE_CHAIN);
  });
});

const RELATIVE_CHAIN = ["packages/api/src", "packages/api", "packages", ""];

const ABSOLUTE = ["c:/a/b/c", "C:\\Users\\vinic\\proj", "/home/u/app", "D:/"];

/**
 * The whole of the bug in one property: a relative step resolves against
 * whatever directory the process happens to be in, and an absolute path never
 * asked for that.
 */
describe("an absolute walk", () => {
  it("never yields a relative step", () => {
    for (const start of ABSOLUTE) {
      const walked = ancestorsOf(start);
      expect(walked.filter((one) => one === "")).toEqual([]);
      expect(walked[walked.length - 1]).toMatch(/^([a-zA-Z]:)?\/$/);
    }
  });
});
