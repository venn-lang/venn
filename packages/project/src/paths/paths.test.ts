import { describe, expect, it } from "vitest";
import { ancestors, isInside, join, normalise, parentOf, relativeTo } from "./paths.js";

describe("path arithmetic without node:path", () => {
  it("normalises separators, repeats and a trailing slash", () => {
    expect(normalise("a\\b//c/")).toBe("a/b/c");
    expect(normalise("/")).toBe("/");
    expect(normalise("")).toBe("");
  });

  it("joins, skipping the parts that are nothing", () => {
    expect(join("a", "b", "c")).toBe("a/b/c");
    expect(join("", "venn.toml")).toBe("venn.toml");
    expect(join("/root", "src")).toBe("/root/src");
  });

  /** The top of a relative walk is the directory it is written against. */
  it("climbs to the top and stops there", () => {
    expect(parentOf("packages/api")).toBe("packages");
    expect(parentOf("packages")).toBe("");
    expect(parentOf("")).toBeUndefined();
    expect(parentOf("/")).toBeUndefined();
    expect(parentOf("/a")).toBe("/");
  });

  it("lists every directory from here to the top", () => {
    expect(ancestors("packages/api/src")).toEqual([
      "packages/api/src",
      "packages/api",
      "packages",
      "",
    ]);
    expect(ancestors("/a/b")).toEqual(["/a/b", "/a", "/"]);
  });

  /** A walk that starts somewhere absolute has to end somewhere absolute. */
  it("stops at the drive root instead of falling off it", () => {
    expect(parentOf("c:/a")).toBe("c:/");
    expect(parentOf("c:/")).toBeUndefined();
    expect(ancestors("C:\\work\\api")).toEqual(["C:/work/api", "C:/work", "C:/"]);
  });

  it("tells what sits inside what, and is not fooled by a shared prefix", () => {
    expect(isInside("a/b", "a")).toBe(true);
    expect(isInside("a", "a")).toBe(true);
    expect(isInside("ab/c", "a")).toBe(false);
  });

  it("writes a path relative to a base, or leaves it alone", () => {
    expect(relativeTo("a/b/c", "a")).toBe("b/c");
    expect(relativeTo("x/y", "a")).toBe("x/y");
  });
});
