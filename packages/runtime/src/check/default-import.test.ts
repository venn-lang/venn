import { parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "../registry/index.js";
import { resolveImports } from "../run/index.js";
import { checkImports } from "./check-imports.js";

/** No plugins loaded: these files import each other, never a package. */
const REGISTRY = buildRegistry({ plugins: [], caps: [] });

const HERE = "/app/main.vn";
const LIB = { "/app/lib.vn": "pub const rate = 1" };

function io(files: Record<string, string>) {
  return {
    read: (uri: string) =>
      uri in files ? Promise.resolve(files[uri] as string) : Promise.reject(new Error("nope")),
    resolve: (_base: string, spec: string) =>
      spec.startsWith(".") ? `/app/${spec.replace("./", "")}` : spec,
  };
}

async function problems(source: string, npm?: Map<string, Record<string, unknown>>) {
  const document = parse(source, { uri: HERE }).ast;
  const graphIo = io(LIB);
  const found = await resolveImports({ document, uri: HERE, io: graphIo });
  const graph = { modules: found.modules, resolve: graphIo.resolve, npm };
  return checkImports({
    document,
    uri: HERE,
    graph,
    registry: REGISTRY,
    unreadable: found.unreadable,
  });
}

/**
 * `import cart from "./cart.vn"`.
 *
 * The spelling is not dead: a package has a default export and the binder reads
 * it. A `.vn` module publishes by name with `pub` and has no default at all, so
 * the field was never read and the name was left holding nothing.
 */
describe("a default import", () => {
  it("is refused against a module, which publishes by name", async () => {
    const found = await problems('import lib from "./lib.vn"\nprint lib');

    expect(found.map((one) => one.code)).toEqual(["VN2009"]);
    expect(found[0]?.title).toBe("A `.vn` module publishes by name, so it has no default.");
  });

  it("names both spellings that do work", async () => {
    const [found] = await problems('import lib from "./lib.vn"\nprint lib');

    expect(found?.help).toContain('import { lib } from "./lib.vn"');
    expect(found?.help).toContain("import * as lib");
  });

  it("is kept for a package that has a default", async () => {
    const npm = new Map([["some-pkg", { default: () => 1 }]]);

    expect(await problems('import thing from "some-pkg"\nprint thing', npm)).toEqual([]);
  });

  it("is refused for a package that has none", async () => {
    const npm = new Map([["some-pkg", { other: 1 }]]);
    const found = await problems('import thing from "some-pkg"\nprint thing', npm);

    expect(found.map((one) => one.code)).toEqual(["VN2009"]);
    expect(found[0]?.title).toBe('"some-pkg" publishes no default.');
  });

  /** No packages loaded at all is every run in a worker, and nobody's fault. */
  it("says nothing about a package when none were loaded", async () => {
    expect(await problems('import thing from "some-pkg"\nprint thing')).toEqual([]);
  });

  it("says nothing about the two spellings that publish by name", async () => {
    expect(await problems('import { rate } from "./lib.vn"\nprint rate')).toEqual([]);
    expect(await problems('import * as lib from "./lib.vn"\nprint lib.rate')).toEqual([]);
  });
});
