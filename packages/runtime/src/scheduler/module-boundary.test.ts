import { ConsolePort, createMemoryConsole, createTestHost } from "@venn-lang/contracts";
import { type Document, parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { checkImports } from "../check/index.js";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/create-runner.js";

const ENTRY = "file:///w/main.vn";

/** A set of files, as the import graph the runner and the checker both read. */
function graph(files: Record<string, string>): {
  modules: Map<string, Document>;
  resolve: (from: string, spec: string) => string;
} {
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
  return { modules, resolve: (_from, spec) => `file:///w/${spec.replace("./", "")}` };
}

/** Every line the entry printed, by running it in script mode. */
async function run(files: Record<string, string>): Promise<string[]> {
  const built = graph(files);
  const console = createMemoryConsole();
  const runner = createRunner({
    host: createTestHost(),
    plugins: [],
    sink: createMemorySink(),
    uri: ENTRY,
    modules: built,
    ports: [{ port: ConsolePort, impl: console }],
  });
  await runner.script(built.modules.get(ENTRY) as Document);
  return console.out.split("\n").filter((line) => line !== "");
}

describe("what a file can publish", () => {
  /**
   * The gap this closes. Without it every file redeclares the shapes it uses,
   * and a shared constant has nowhere to live.
   */
  it("publishes a binding, and the importer gets its value", async () => {
    const printed = await run({
      "lib.vn": "pub const LIMIT = 10\n",
      "main.vn": 'import { LIMIT } from "./lib.vn"\nprint LIMIT\n',
    });

    expect(printed).toEqual(["10"]);
  });

  /**
   * A `pub const` is computed where it stands, so the module it reads from has
   * to be filled first. Filling them in map order left this one computing
   * against nothing.
   */
  it("fills a chain of modules in the order they depend on each other", async () => {
    const printed = await run({
      "base.vn": "pub const BASE = 10\n",
      "middle.vn": 'import { BASE } from "./base.vn"\npub const DOUBLED = BASE * 2\n',
      "main.vn": 'import { DOUBLED } from "./middle.vn"\nprint DOUBLED\n',
    });

    expect(printed).toEqual(["20"]);
  });

  it("lets an imported function read a value from its own file", async () => {
    const printed = await run({
      "lib.vn": "const SECRET = 7\npub fn reveal() => SECRET\n",
      "main.vn": 'import { reveal } from "./lib.vn"\nprint reveal()\n',
    });

    expect(printed).toEqual(["7"]);
  });

  it("gathers bindings and functions alike under a wildcard", async () => {
    const printed = await run({
      "lib.vn": "pub const LIMIT = 10\npub fn double(n) => n * 2\n",
      "main.vn": 'import * as lib from "./lib.vn"\nprint lib.LIMIT\nprint lib.double(3)\n',
    });

    expect(printed).toEqual(["10", "6"]);
  });

  it("keeps a private binding private", () => {
    const built = graph({
      "lib.vn": "const HIDDEN = 1\n",
      "main.vn": 'import { HIDDEN } from "./lib.vn"\nprint HIDDEN\n',
    });

    const problems = checkImports({
      document: built.modules.get(ENTRY) as Document,
      uri: ENTRY,
      graph: built,
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]?.title).toContain("does not publish HIDDEN");
  });

  /** Two different mistakes, and the fix for each is different. */
  it("says whether the name is private or absent", () => {
    const built = graph({
      "lib.vn": "const HIDDEN = 1\n",
      "main.vn": 'import { HIDDEN, NOTHING } from "./lib.vn"\n',
    });

    const problems = checkImports({
      document: built.modules.get(ENTRY) as Document,
      uri: ENTRY,
      graph: built,
    });

    expect(problems[0]?.note).toContain("not marked");
    expect(problems[1]?.note).toContain("Nothing of that name");
  });

  /**
   * A package is not a file in the graph, so it has no place in the order the
   * files are filled in. It is skipped rather than resolved as a path.
   */
  it("orders the files without tripping over a package import", async () => {
    const printed = await run({
      "lib.vn": 'import { z } from "zod"\npub const LIMIT = 10\n',
      "main.vn": 'import { LIMIT } from "./lib.vn"\nprint LIMIT\n',
    });

    expect(printed).toEqual(["10"]);
  });

  /** A file the graph never loaded, which is what a broken path looks like here. */
  it("carries on when an import names a file that is not there", async () => {
    const printed = await run({
      "lib.vn": 'import { X } from "./gone.vn"\npub const LIMIT = 10\n',
      "main.vn": 'import { LIMIT } from "./lib.vn"\nprint LIMIT\n',
    });

    expect(printed).toEqual(["10"]);
  });

  it("publishes a type, which is a name rather than a value", () => {
    const built = graph({
      "lib.vn": "pub type User { name: string }\n",
      "main.vn": 'import { User } from "./lib.vn"\nconst u: User = { name: "ana" }\n',
    });

    const problems = checkImports({
      document: built.modules.get(ENTRY) as Document,
      uri: ENTRY,
      graph: built,
    });

    expect(problems).toEqual([]);
  });
});
