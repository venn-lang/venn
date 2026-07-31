import { createPosixPaths, createWindowsPaths, type Paths } from "@venn-lang/contracts";
import type { ActionContext } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { pathPlugin } from "./plugin.js";

const actions = pathPlugin.actions ?? [];

/** Both spellings, so nothing here can quietly depend on one of them. */
const HOSTS = [
  { name: "posix", paths: createPosixPaths({ cwd: "/srv/app" }), sep: "/", root: "/srv/app" },
  {
    name: "windows",
    paths: createWindowsPaths({ cwd: "C:\\srv\\app" }),
    sep: "\\",
    root: "C:\\srv\\app",
  },
] as const;

/** Run one verb the way a program written in Venn would. */
function run(paths: Paths, name: string, ...args: unknown[]): unknown {
  const found = actions.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`path.${name} is not a verb`);
  const ctx = { port: () => paths } as unknown as ActionContext;
  return found.run(ctx, { args, params: {} });
}

for (const host of HOSTS) {
  const at = (...parts: string[]): string => parts.join(host.sep);
  const call = (name: string, ...args: unknown[]): unknown => run(host.paths, name, ...args);

  describe(`making a path · ${host.name}`, () => {
    it("joins the parts with the separator this host writes", () => {
      expect(call("join", "src", "lib", "x.vn")).toBe(at("src", "lib", "x.vn"));
    });

    it("does not double the separator on a part that already ends in one", () => {
      expect(call("join", at("src", ""), "lib")).toBe(at("src", "lib"));
    });

    it("skips a part that is nothing at all", () => {
      expect(call("join", "src", "", "lib")).toBe(at("src", "lib"));
      expect(call("join", "src", null, "lib")).toBe(at("src", "lib"));
    });

    it("works out `..` and `.` while it joins", () => {
      expect(call("join", "src", "lib", "..", "test")).toBe(at("src", "test"));
      expect(call("join", "src", ".", "lib")).toBe(at("src", "lib"));
    });

    it("starts over at a part that stands on its own", () => {
      expect(call("join", "src", host.root)).toBe(host.root);
    });

    it("resolves a relative path from where the program is", () => {
      expect(call("resolve", "logs", "run.txt")).toBe(at(host.root, "logs", "run.txt"));
      expect(call("cwd")).toBe(host.root);
    });

    it("leaves an absolute path where it already is", () => {
      expect(call("resolve", at(host.root, "x"))).toBe(at(host.root, "x"));
    });

    it("walks from one path to another, and nowhere from a path to itself", () => {
      expect(
        call("relative", at(host.root, "src", "lib"), at(host.root, "src", "test", "x.vn")),
      ).toBe(at("..", "test", "x.vn"));
      expect(call("relative", host.root, host.root)).toBe("");
    });

    it("tidies a path without being asked to join anything", () => {
      expect(call("normalize", at("src", "lib", "..", ".", "test"))).toBe(at("src", "test"));
    });
  });

  describe(`taking a path apart · ${host.name}`, () => {
    const file = at(host.root, "reports", "run.tar.gz");

    it("names the file and the directory it is in", () => {
      expect(call("basename", file)).toBe("run.tar.gz");
      expect(call("dirname", file)).toBe(at(host.root, "reports"));
    });

    it("takes only the last extension, and leaves the rest of the name", () => {
      expect(call("extension", file)).toBe(".gz");
      expect(call("stem", file)).toBe("run.tar");
    });

    it("finds no extension where there is none", () => {
      expect(call("extension", at(host.root, "Makefile"))).toBe("");
      expect(call("stem", at(host.root, "Makefile"))).toBe("Makefile");
    });

    /** The whole of `.gitignore` is the name; reading it as an extension leaves none. */
    it("does not read a leading dot as an extension", () => {
      expect(call("extension", at(host.root, ".gitignore"))).toBe("");
      expect(call("stem", at(host.root, ".gitignore"))).toBe(".gitignore");
    });

    it("says a lone name has no parent to speak of", () => {
      expect(call("dirname", "solo.vn")).toBe(".");
    });

    it("renames an output after its input", () => {
      expect(call("withExtension", at("out", "run.json"), "csv")).toBe(at("out", "run.csv"));
      expect(call("withExtension", at("out", "run.json"), ".csv")).toBe(at("out", "run.csv"));
    });

    it("takes the extension off when asked for none", () => {
      expect(call("withExtension", at("out", "run.json"), "")).toBe(at("out", "run"));
    });

    /** A dot in a directory is not the file's extension, and must survive. */
    it("renames only the last part", () => {
      expect(call("withExtension", at("v1.2", "run.json"), "csv")).toBe(at("v1.2", "run.csv"));
    });

    it("hands back the parts, keeping the root of an absolute path", () => {
      expect(call("split", at("src", "lib", "x.vn"))).toEqual(["src", "lib", "x.vn"]);
      expect(call("split", at(host.root, "x"))).toEqual([...host.paths.split(host.root), "x"]);
    });
  });

  describe(`asking where a path leads · ${host.name}`, () => {
    it("says which paths stand on their own", () => {
      expect(call("isAbsolute", host.root)).toBe(true);
      expect(call("isAbsolute", at("src", "lib"))).toBe(false);
    });

    it("says a path under a directory is inside it, and so is the directory itself", () => {
      expect(call("isInside", "uploads", at("uploads", "a", "b.txt"))).toBe(true);
      expect(call("isInside", "uploads", "uploads")).toBe(true);
    });

    /** The whole point: a name from outside that climbs out is caught before it is used. */
    it("catches a name that climbs out of the directory it was given", () => {
      expect(call("isInside", "uploads", at("uploads", "..", "etc", "passwd"))).toBe(false);
      expect(call("isInside", "uploads", at("..", "etc", "passwd"))).toBe(false);
    });

    it("catches one that leaves by being absolute", () => {
      expect(call("isInside", "uploads", at(host.root, "etc", "passwd"))).toBe(false);
    });

    /** A directory whose name merely starts the same is a different directory. */
    it("is not fooled by a sibling with a longer name", () => {
      expect(call("isInside", at(host.root, "data"), at(host.root, "data-evil", "x"))).toBe(false);
    });

    it("catches a climb that ends up back inside, because it never left", () => {
      expect(call("isInside", "uploads", at("uploads", "a", "..", "b"))).toBe(true);
    });
  });
}

describe("what the namespace publishes", () => {
  it("types every verb it has", () => {
    const untyped = actions.filter((action) => !action.signature);

    expect(untyped.map((action) => action.name)).toEqual([]);
  });

  it("publishes the verbs a program needs and no separator to go with them", () => {
    expect(actions.map((action) => action.name).sort()).toEqual([
      "basename",
      "cwd",
      "dirname",
      "extension",
      "isAbsolute",
      "isInside",
      "join",
      "normalize",
      "relative",
      "resolve",
      "split",
      "stem",
      "withExtension",
    ]);
  });
});

/** The same program, on two hosts, writing the path each host writes. */
describe("one program, whichever host runs it", () => {
  it("joins with the separator of the host it is on, never one it chose", () => {
    expect(run(HOSTS[0].paths, "join", "a", "b")).toBe("a/b");
    expect(run(HOSTS[1].paths, "join", "a", "b")).toBe("a\\b");
  });

  it("reads a windows path on windows and a name with a backslash on posix", () => {
    expect(run(HOSTS[1].paths, "split", "a\\b")).toEqual(["a", "b"]);
    expect(run(HOSTS[0].paths, "split", "a\\b")).toEqual(["a\\b"]);
  });
});
