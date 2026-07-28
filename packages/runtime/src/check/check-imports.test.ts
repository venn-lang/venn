import { type Document, parse } from "@venn/core";
import { describe, expect, it } from "vitest";
import { checkImports } from "./check-imports.js";

const LIB = `fn privado(x: number) -> number => x
pub fn publico(x: number) -> number => x
pub fragment entrar(user) { step "s" { expect true } }`;

function graphOf(): { modules: Map<string, Document>; resolve: () => string } {
  const { ast } = parse(LIB, { uri: "/lib.vn" });
  return { modules: new Map([["/lib.vn", ast]]), resolve: () => "/lib.vn" };
}

function problems(source: string): string[] {
  const { ast } = parse(source, { uri: "/main.vn" });
  return checkImports({ document: ast, uri: "/main.vn", graph: graphOf() }).map(
    (problem) => `${problem.code} ${problem.title}`,
  );
}

/**
 * Importing a name the other file did not publish.
 *
 * Otherwise the mistake surfaces at run time, as a value that stays quietly
 * `undefined` until something calls it: "this value is not a function", which is
 * true and says nothing about the import three screens up.
 */
describe("a name that is not published", () => {
  it("is reported where it is imported", () => {
    expect(problems('import { naoExiste } from "./lib.vn"')).toEqual([
      'VN2009 "./lib.vn" does not publish naoExiste.',
    ]);
  });

  /** Kept private and never written are different mistakes with different fixes. */
  it("says which of the two mistakes it is", () => {
    const { ast } = parse('import { privado } from "./lib.vn"', { uri: "/main.vn" });
    const found = checkImports({ document: ast, uri: "/main.vn", graph: graphOf() });

    expect(found[0]?.note).toContain("not marked");
    expect(found[0]?.note).not.toContain("Nothing of that name");
  });

  it("says so plainly when nothing of the name is there", () => {
    const { ast } = parse('import { seja } from "./lib.vn"', { uri: "/main.vn" });
    const found = checkImports({ document: ast, uri: "/main.vn", graph: graphOf() });

    expect(found[0]?.note).toContain("Nothing of that name");
  });

  it("says nothing about what the file did publish", () => {
    expect(problems('import { publico, entrar } from "./lib.vn"')).toEqual([]);
  });

  /** A file that could not be read is already reported by whoever read it. */
  it("says nothing about a file it never reached", () => {
    const { ast } = parse('import { x } from "./ausente.vn"', { uri: "/main.vn" });
    const graph = { modules: new Map<string, Document>(), resolve: () => "/ausente.vn" };

    expect(checkImports({ document: ast, uri: "/main.vn", graph })).toEqual([]);
  });
});
