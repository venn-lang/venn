import { describe, expect, it } from "vitest";
import type { Document } from "../generated/ast.js";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";
import { importedTypes } from "./imported-types.js";

const ENTRY = "file:///w/main.vn";

/** The titles reported for the entry file, with the other files around it. */
function titles(files: Record<string, string>): string[] {
  const modules = new Map<string, Document>();
  for (const [name, source] of Object.entries(files)) {
    const uri = `file:///w/${name}`;
    const { ast, problems } = parse(source, { uri });
    expect(
      problems.map((problem) => problem.title),
      name,
    ).toEqual([]);
    modules.set(uri, ast);
  }
  const resolve = (_from: string, spec: string): string => `file:///w/${spec.replace("./", "")}`;
  const document = modules.get(ENTRY) as Document;
  const imports = importedTypes({ document, uri: ENTRY, modules, resolve });
  return checkTypes(document, { uri: ENTRY, imports }).problems.map((problem) => problem.title);
}

const SHAPES = { "lib.vn": "pub type User { name: string }\npub const LIMIT = 10\n" };

describe("a shape another file published", () => {
  /**
   * The gap this closes. Before it the name resolved to nothing in particular,
   * so a value of the wrong shape checked clean and every file redeclared the
   * shapes it used.
   */
  it("checks a value against the shape it names", () => {
    expect(titles({ ...SHAPES, "main.vn": IMPORT + 'const u: User = { name: "ana" }' })).toEqual(
      [],
    );
  });

  it("refuses a field the shape does not have", () => {
    const said = titles({ ...SHAPES, "main.vn": IMPORT + 'const u: User = { nome: "ana" }' });

    expect(said[0]).toContain("expected { name: string }");
    expect(said[0]).toContain("nome");
  });

  it("refuses a field of the wrong type", () => {
    const said = titles({ ...SHAPES, "main.vn": IMPORT + "const u: User = { name: 42 }" });

    expect(said[0]).toContain("expected { name: string }");
  });

  it("refuses reading a field the shape does not carry", () => {
    const source = `${IMPORT}const u: User = { name: "ana" }\nprint u.missing`;

    expect(titles({ ...SHAPES, "main.vn": source })[0]).toContain('has no field "missing"');
  });

  it("gives an imported binding the type it has", () => {
    const source = `${IMPORT}fn takesNumber(n: number) -> number => n\nprint takesNumber(LIMIT)`;

    expect(titles({ ...SHAPES, "main.vn": source })).toEqual([]);
  });

  it("refuses an imported binding used as the wrong type", () => {
    const source = `${IMPORT}fn takesString(s: string) -> string => s\nprint takesString(LIMIT)`;

    expect(titles({ ...SHAPES, "main.vn": source })[0]).toContain("Type mismatch");
  });

  /** A file that declares a name of its own keeps it, as a local binding does. */
  it("prefers a local declaration of the same name", () => {
    const source = `${IMPORT}type User { age: number }\nconst u: User = { age: 1 }`;

    expect(titles({ ...SHAPES, "main.vn": source })).toEqual([]);
  });

  it("follows a shape through the file that re-published it", () => {
    const files = {
      "base.vn": "pub type User { name: string }\n",
      "middle.vn": 'import { User } from "./base.vn"\npub type Team { lead: User }\n',
      "main.vn": 'import { Team } from "./middle.vn"\nconst t: Team = { lead: { name: 42 } }\n',
    };

    expect(titles(files)[0]).toContain("expected { lead: { name: string } }");
  });

  it("says nothing about a name no file published", () => {
    const source = `${IMPORT}const u: Unpublished = { anything: 1 }`;

    expect(titles({ ...SHAPES, "main.vn": source })).toEqual([]);
  });
});

const IMPORT = 'import { User, LIMIT } from "./lib.vn"\n';
