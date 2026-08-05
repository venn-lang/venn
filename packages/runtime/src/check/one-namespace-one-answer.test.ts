import { ALL_CAPABILITIES } from "@venn-lang/contracts";
import { type Document, type Problem, parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "../registry/index.js";
import { collectFragments } from "../scheduler/index.js";
import { checkDocument } from "./check-document.js";
import { checkImports } from "./check-imports.js";

const verb = (name: string) => defineAction({ name, run: () => undefined });

const io = definePlugin({
  name: "venn/io",
  namespace: "io",
  actions: [verb("print"), verb("args"), verb("readLine")],
});

const fmt = definePlugin({ name: "venn/fmt", namespace: "fmt", actions: [verb("json")] });

const registry = buildRegistry({ plugins: [io, fmt], caps: ALL_CAPABILITIES });

function check(source: string): Problem[] {
  const { ast, problems } = parse(source, { uri: "/main.vn" });
  expect(problems).toEqual([]);
  const fragments = new Set(collectFragments(ast).keys());
  return checkDocument({ document: ast, registry, fragments, uri: "/main.vn" });
}

const said = (source: string) => check(source).map((one) => `${one.code} ${one.title}`);

/**
 * The same expression written three ways used to get three verdicts: the value
 * read ran, the bare read asked for brackets under VN2008, and the bracketed
 * call was then refused under VN2007 for want of an import. VN2008 demanded
 * exactly the spelling VN2007 rejected, so no spelling satisfied both.
 */
describe("one namespace, one answer", () => {
  it("refuses none of the three ways to write the same verb", () => {
    const source = "let a = io.args\nlet b = io.args()\nprint io.args()\n";

    expect(check(source).filter((one) => one.severity === "error")).toEqual([]);
  });

  it("still asks for the brackets where the verb is read as a value", () => {
    expect(said("print io.args")).toContain(
      "VN2008 `io.args` is a verb, not a value: write `io.args()` to call it.",
    );
  });

  it("reports the verb the namespace does not publish, with no import written", () => {
    const found = check('print io.readFile("x")');

    expect(found[0]?.code).toBe("VN2003");
    expect(found[0]?.title).toBe('"io" does not publish "readFile".');
    expect(found[0]?.help).toBe("Did you mean `io.readLine`?");
  });

  /**
   * The suggestion is a claim that the spelling exists, so it is asserted on
   * the reader's own line rather than on a tidied one: the argument they wrote
   * stays where it was, and what is left is the import hint and nothing else.
   */
  it("leaves nothing behind once the suggested verb is written", () => {
    expect(said('print io.readLine("x")')).toEqual(['VN2007 "io" is not imported in this file.']);
  });

  /** One mistake, one sentence, whichever of the two call forms wrote it. */
  it("says the same of a statement call as of an expression call", () => {
    const statement = check('io.readFile "x"')[0];
    const expression = check('let a = io.readFile("x")')[0];

    expect(statement?.title).toBe(expression?.title);
    expect(statement?.help).toBe(expression?.help);
  });

  it("still says an unknown namespace is an unknown action", () => {
    expect(said("nope.doThing")).toEqual([
      'VN2003 Unknown action "nope.doThing": no loaded plugin provides it.',
    ]);
  });
});

/**
 * The import stops being a gate and stays worth writing, so it is said as a
 * hint, once for the file, with the path the diagnostic was already holding.
 */
describe("the import a file did not write", () => {
  it("names the module path instead of an ellipsis", () => {
    const found = check('io.print "x"')[0];

    expect(found?.code).toBe("VN2007");
    expect(found?.severity).toBe("hint");
    expect(found?.help).toBe('Write `import { io } from "venn/io"`.');
  });

  it("names the right path for a namespace that is not io", () => {
    expect(check("let a = fmt.json(1)")[0]?.help).toBe('Write `import { fmt } from "venn/fmt"`.');
  });

  it("is said once however many times the namespace is used", () => {
    const source = 'io.print "a"\nio.print "b"\nlet c = io.args()\n';

    expect(said(source)).toEqual(['VN2007 "io" is not imported in this file.']);
  });

  it("says nothing once the import is written", () => {
    expect(said('import { io } from "venn/io"\nio.print "x"')).toEqual([]);
  });

  /** A name of the file's own wins over a namespace spelled the same way. */
  it("says nothing about a name this file binds", () => {
    expect(said("const fmt = { json: 1 }\nlet a = fmt.json\n")).toEqual([]);
  });
});

const GRAPH = { modules: new Map<string, Document>(), resolve: () => "/lib.vn" };

function imports(source: string): Problem[] {
  const { ast } = parse(source, { uri: "/main.vn" });
  return checkImports({ document: ast, uri: "/main.vn", graph: GRAPH, registry });
}

/**
 * An import of a package nothing publishes used to exit zero with no output,
 * and the first use of the name failed with a locationless "this value is not
 * a function", which never mentioned the path.
 */
describe("an import of a package nothing publishes", () => {
  it("is refused at the import that wrote it", () => {
    const found = imports('import { file } from "venn/file"')[0];

    expect(found?.code).toBe("VN2028");
    expect(found?.title).toBe('No package is called "venn/file".');
    expect(found?.span.line).toBe(1);
  });

  /**
   * The candidate set is the loaded packages, so it grows with the registry.
   * Compared on the part that differs: on the whole path the shared `venn/`
   * loosens the suggester's bound until any two names of a size look near.
   */
  it("offers the nearest path there is", () => {
    expect(imports('import { io } from "venn/iio"')[0]?.help).toBe('Did you mean "venn/io"?');
  });

  it("offers nothing rather than a wrong guess", () => {
    expect(imports('import { file } from "venn/file"')[0]?.help).toBeUndefined();
  });

  it("accepts every package the run did load", () => {
    expect(imports('import { io } from "venn/io"')).toEqual([]);
    expect(imports('import { fmt } from "venn/fmt"')).toEqual([]);
  });

  /** An installed dependency is resolved elsewhere and is nobody's mistake here. */
  it("says nothing about a specifier from another family", () => {
    expect(imports('import { z } from "zod"')).toEqual([]);
  });
});
