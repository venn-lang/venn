import { describe, expect, it } from "vitest";
import { isDecoDecl } from "../../generated/ast.js";
import { parse } from "../../parse/index.js";
import type { Problem } from "../../problem/index.js";
import { expand } from "../expand.js";
import { readMeta } from "../node-meta.js";
import type { ImportedDeco } from "./deco.types.js";

const NOTHING = { get: () => undefined };

/** A `pub deco` written in another file, as expansion receives it. */
function exported(source: string, uri = "/lib.vn"): Map<string, ImportedDeco> {
  const { ast, problems } = parse(source, { uri });
  expect(problems).toEqual([]);
  const found = new Map<string, ImportedDeco>();
  for (const decl of ast.decls) {
    if (isDecoDecl(decl) && decl.export) found.set(decl.name, { decl, uri });
  }
  return found;
}

function expandWith(source: string, imported: Map<string, ImportedDeco>) {
  const { ast, problems } = parse(source, { uri: "/main.vn" });
  expect(problems).toEqual([]);
  const found: Problem[] = expand({
    document: ast,
    decorators: NOTHING,
    uri: "/main.vn",
    imported,
  }).problems;
  return { ast, problems: found };
}

const SHOUT = 'pub deco shout(target: Fn) { target.meta "shout" true }';

/**
 * A decorator crosses a file the way everything else does: the file that wrote
 * it says `pub`, the file that wants it says `import`. Without this the keyword
 * parsed and meant nothing, which is worse than not having it.
 */
describe("a pub deco reaches the file that imports it", () => {
  it("resolves and runs on the importing file's own declaration", () => {
    const { ast, problems } = expandWith(
      ["@shout", "fn quiet(x) => x"].join("\n"),
      exported(SHOUT),
    );

    expect(problems).toEqual([]);
    expect(readMeta(ast.decls[0] as object, "shout")).toBe(true);
  });

  it("checks the kind against the signature it was written with", () => {
    const { problems } = expandWith(["@shout", 'flow "f" { }'].join("\n"), exported(SHOUT));

    expect(problems.map((one) => one.code)).toEqual(["VN2014"]);
    expect(problems[0]?.title).toBe("@shout decorates a function, and this is a flow.");
  });

  it("loses to a `deco` of the same name written here", () => {
    const local = 'deco shout(target: Fn) { target.meta "local" true }';
    const { ast, problems } = expandWith(
      [local, "@shout", "fn quiet(x) => x"].join("\n"),
      exported(SHOUT),
    );

    expect(problems).toEqual([]);
    expect(readMeta(ast.decls[1] as object, "local")).toBe(true);
    expect(readMeta(ast.decls[1] as object, "shout")).toBeUndefined();
  });

  /** A library may export ten and this file write one; nine faults are not ours. */
  it("says nothing about an exported `deco` this file never applies", () => {
    const library = ["pub deco broken() { }", SHOUT].join("\n");

    const { problems } = expandWith(["@shout", "fn quiet(x) => x"].join("\n"), exported(library));

    expect(problems).toEqual([]);
  });

  it("reports a fault in one at the line that wrote it, not the line that used it", () => {
    const { problems } = expandWith(
      ["@broken", "fn quiet(x) => x"].join("\n"),
      exported("pub deco broken() { }"),
    );

    expect(problems.map((one) => one.code)).toEqual(["VN2015"]);
    expect(problems[0]?.span.uri).toBe("/lib.vn");
  });

  it("still lets an unimported name fall through to the host", () => {
    const { ast, problems } = parse('@skip\nflow "f" { }', { uri: "/main.vn" });
    expect(problems).toEqual([]);
    const seen: string[] = [];

    expand({
      document: ast,
      decorators: { get: (name) => ({ name, expand: () => seen.push(name) }) },
      uri: "/main.vn",
      imported: exported(SHOUT),
    });

    expect(seen).toEqual(["skip"]);
  });
});
