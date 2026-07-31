import { describe, expect, it } from "vitest";
import { pathsConformance } from "./paths.suite.js";
import { createPosixPaths } from "./posix-paths.js";
import { createWindowsPaths } from "./windows-paths.js";

pathsConformance({
  name: "posix",
  factory: createPosixPaths,
  absolute: "/srv/app",
  root: "/",
});

pathsConformance({
  name: "windows",
  factory: createWindowsPaths,
  absolute: "C:\\srv\\app",
  root: "C:\\",
});

/** What each spelling owns, which the shared suite has no way to ask about. */
describe("the way posix writes a path", () => {
  const paths = createPosixPaths({ cwd: "/srv" });

  it("keeps two names that differ only by case apart", () => {
    expect(paths.relative("/srv/App", "/srv/app")).toBe("../app");
  });

  it("reads a backslash as a character in a name, because it is one", () => {
    expect(paths.split("a\\b")).toEqual(["a\\b"]);
  });

  it("starts at the root, and nowhere else", () => {
    expect(paths.isAbsolute("/x")).toBe(true);
    expect(paths.isAbsolute("C:\\x")).toBe(false);
  });
});

describe("the way windows writes a path", () => {
  const paths = createWindowsPaths({ cwd: "C:\\srv" });

  it("takes either separator and writes back its own", () => {
    expect(paths.join(["C:/srv", "app/main.vn"])).toBe("C:\\srv\\app\\main.vn");
  });

  it("treats two names that differ only by case as one", () => {
    expect(paths.relative("C:\\srv\\App", "C:\\SRV\\app")).toBe("");
  });

  it("starts at a drive, at a share, or at whichever drive it is standing on", () => {
    expect(paths.isAbsolute("C:\\x")).toBe(true);
    expect(paths.isAbsolute("\\\\server\\share\\x")).toBe(true);
    expect(paths.isAbsolute("\\x")).toBe(true);
  });

  /** `C:x` means wherever that drive is standing, which is not a place yet. */
  it("does not call a drive without a separator absolute", () => {
    expect(paths.isAbsolute("C:x")).toBe(false);
    expect(paths.normalize("C:a\\..\\b")).toBe("C:b");
  });

  it("keeps a share whole, because the machine and the share are its root", () => {
    expect(paths.dirname("\\\\server\\share\\a\\b")).toBe("\\\\server\\share\\a");
    expect(paths.join(["\\\\server\\share", "..", "..", "a"])).toBe("\\\\server\\share\\a");
  });

  /** No walk joins one machine's share to another's drive; the place itself is the answer. */
  it("answers with the place when there is no walk from one root to another", () => {
    expect(paths.relative("C:\\srv", "\\\\server\\share\\a")).toBe("\\\\server\\share\\a");
  });
});
