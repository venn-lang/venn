import { parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "../registry/index.js";
import { resolveImports } from "../run/index.js";
import { checkImports } from "./check-imports.js";

/** No plugins loaded: these files import each other, never a package. */
const REGISTRY = buildRegistry({ plugins: [], caps: [] });

/** A file system of source, keyed by path, and nothing else on it. */
function io(files: Record<string, string>) {
  return {
    read: (uri: string) =>
      uri in files ? Promise.resolve(files[uri] as string) : Promise.reject(new Error("nope")),
    resolve: (_base: string, spec: string) =>
      spec.startsWith(".") ? `/app/${spec.replace("./", "")}` : spec,
  };
}

async function problems(entry: string, files: Record<string, string>) {
  const document = parse(files[entry] as string, { uri: entry }).ast;
  const graphIo = io(files);
  const found = await resolveImports({ document, uri: entry, io: graphIo });
  const graph = { modules: found.modules, resolve: graphIo.resolve };
  return checkImports({ document, uri: entry, graph, registry: REGISTRY, cycles: found.cycles });
}

const TWO = {
  "/app/a.vn": 'import * as b from "./b.vn"\npub const a = 1\nprint b.b',
  "/app/b.vn": 'import * as a from "./a.vn"\npub const b = 1',
};

const THREE = {
  "/app/a.vn": 'import * as b from "./b.vn"\npub const a = 1',
  "/app/b.vn": 'import * as c from "./c.vn"\npub const b = 1',
  "/app/c.vn": 'import * as a from "./a.vn"\npub const c = 1',
};

/**
 * Files that import each other.
 *
 * A `const` at the top of a file is evaluated when the file is, so one side
 * reads what the other has not filled yet, and which side depends on which file
 * the run entered first. It used to run anyway: the walk skipped a file it had
 * already seen, which ended the loop and left the answer to chance.
 */
describe("files that import each other", () => {
  it("is refused, with the import that closes the circle named", async () => {
    const found = await problems("/app/a.vn", TWO);

    expect(found.map((one) => one.code)).toEqual(["VN2021"]);
    expect(found[0]?.title).toBe('Importing "./a.vn" here closes a circle.');
  });

  it("shows the way round, one file at a time", async () => {
    const [found] = await problems("/app/a.vn", THREE);

    expect(found?.related?.map((one) => `${one.span.uri} ${one.label}`)).toEqual([
      "/app/a.vn imports b.vn",
      "/app/b.vn imports c.vn",
      "/app/c.vn imports a.vn",
    ]);
  });

  /**
   * The same three files, whichever door the walk came in by. A folder is
   * checked file by file, and one mistake reported three times is two too many.
   */
  it("reads the same from every file that leads into it", async () => {
    const fromA = await problems("/app/a.vn", THREE);
    const fromB = await problems("/app/b.vn", THREE);
    const fromC = await problems("/app/c.vn", THREE);

    expect(fromB[0]?.span.uri).toBe(fromA[0]?.span.uri);
    expect(fromC[0]?.title).toBe(fromA[0]?.title);
  });

  it("says what to do about it", async () => {
    const [two] = await problems("/app/a.vn", TWO);
    const [three] = await problems("/app/a.vn", THREE);

    expect(two?.help).toContain("both files");
    expect(three?.help).toContain("these files");
  });
});

describe("what is not a circle", () => {
  /** Two files importing the same third meet there; they do not close a loop. */
  it("says nothing about a diamond", async () => {
    const files = {
      "/app/a.vn": 'import { b } from "./b.vn"\nimport { c } from "./c.vn"\nprint (b + c)',
      "/app/b.vn": 'import { d } from "./d.vn"\npub const b = d',
      "/app/c.vn": 'import { d } from "./d.vn"\npub const c = d',
      "/app/d.vn": "pub const d = 1",
    };

    expect(await problems("/app/a.vn", files)).toEqual([]);
  });

  it("says nothing about a chain that ends", async () => {
    const files = {
      "/app/a.vn": 'import { b } from "./b.vn"\nprint b',
      "/app/b.vn": 'import { c } from "./c.vn"\npub const b = c',
      "/app/c.vn": "pub const c = 1",
    };

    expect(await problems("/app/a.vn", files)).toEqual([]);
  });
});
