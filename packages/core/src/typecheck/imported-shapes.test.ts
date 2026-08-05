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

  /** The names are the whole of it, so the two shapes are not printed at all. */
  it("refuses a field the shape does not have", () => {
    const said = titles({ ...SHAPES, "main.vn": IMPORT + 'const u: User = { nome: "ana" }' });

    expect(said[0]).toBe('This map is missing "name", and has "nome" instead.');
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

  /**
   * A name no file published is a name nothing declares, and it is refused the
   * way an unbound value name is. It used to be silence, which read as approval
   * and switched checking off for whatever it annotated.
   */
  it("refuses a name no file published", () => {
    const source = `${IMPORT}const u: Unpublished = { anything: 1 }`;

    expect(titles({ ...SHAPES, "main.vn": source })).toEqual([
      'Nothing is named "Unpublished" here.',
    ]);
  });
});

const IMPORT = 'import { User, LIMIT } from "./lib.vn"\n';

/**
 * A module nobody could read publishes nothing *known*, which is not the same as
 * publishing nothing.
 *
 * Typed as an empty shape, every use of the namespace drew a second error
 * blaming the field for a mistake in the path. The import says what is wrong;
 * nothing after it should say it again, differently and wrongly.
 */
describe("a namespace whose module was never reached", () => {
  it("is unknown rather than empty, so nothing off it is a field error", () => {
    const source = 'import * as gone from "./gone.vn"\nprint gone.whatever';
    const document = parse(source, { uri: "/app/main.vn" }).ast;

    const imports = importedTypes({
      document,
      uri: "/app/main.vn",
      modules: new Map(),
      resolve: (_from, spec) => spec,
    });

    expect(imports.get("gone")).toEqual({ kind: "dynamic" });
  });
});

/**
 * A type handed on with `pub import`.
 *
 * The name arrives one file further than it was declared, and has to keep the
 * shape it had: a barrel that loses the type publishes a name the checker
 * cannot say anything about.
 */
describe("a type handed on by a barrel", () => {
  it("keeps its shape a file further on", () => {
    const found = titles({
      "models.vn": "pub type User = { name: string }",
      "mod.vn": 'pub import { User } from "./models.vn"',
      "main.vn": 'import { User } from "./mod.vn"\nconst u: User = { name: 1 }\nprint u',
    });

    expect(found).toEqual(["Type mismatch: expected { name: string }, found { name: number }."]);
  });

  it("says nothing when the value fits", () => {
    const found = titles({
      "models.vn": "pub type User = { name: string }",
      "mod.vn": 'pub import { User } from "./models.vn"',
      "main.vn": 'import { User } from "./mod.vn"\nconst u: User = { name: "a" }\nprint u',
    });

    expect(found).toEqual([]);
  });
});

/**
 * A generic published by one file and used by another.
 *
 * It has to cross as a generic. Filling its parameters with fresh variables to
 * make it a type would make `Box<string>` accept anything, which is the silence
 * this milestone exists to remove.
 */
describe("a generic another file published", () => {
  it("is filled by the use site, and refuses what does not fit", () => {
    const found = titles({
      "models.vn": "pub type Box<T> = { held: T }",
      "main.vn": 'import { Box } from "./models.vn"\nconst b: Box<string> = { held: 1 }\nprint b',
    });

    expect(found).toEqual(["Type mismatch: expected { held: string }, found { held: number }."]);
  });

  it("says nothing when what was filled in fits", () => {
    const found = titles({
      "models.vn": "pub type Box<T> = { held: T }",
      "main.vn": 'import { Box } from "./models.vn"\nconst b: Box<string> = { held: "x" }\nprint b',
    });

    expect(found).toEqual([]);
  });
});

/**
 * A namespace gathering a whole module leaves the generics out of its shape.
 *
 * One has no shape until a use site fills it, and `ns.Box` is not how one is
 * written: it is written `Box<string>`, after being imported by name.
 */
describe("a module gathered whole, with a generic in it", () => {
  it("still answers for the plain names beside it", () => {
    const found = titles({
      "models.vn": "pub type Box<T> = { held: T }\npub const rate = 2",
      "main.vn": 'import * as models from "./models.vn"\nprint models.rate',
    });

    expect(found).toEqual([]);
  });
});
