import { parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "../registry/index.js";
import { resolveImports } from "../run/index.js";
import { checkImports } from "./check-imports.js";

/** No plugins loaded: these files import each other, never a package. */
const REGISTRY = buildRegistry({ plugins: [], caps: [] });

const HERE = "/app/main.vn";

/** A file system of source, keyed by path, and nothing else on it. */
function io(files: Record<string, string>) {
  return {
    read: (uri: string) =>
      uri in files ? Promise.resolve(files[uri] as string) : Promise.reject(new Error("nope")),
    resolve: (_base: string, spec: string) =>
      spec.startsWith(".") ? `/app/${spec.replace("./", "")}` : spec,
  };
}

async function problems(source: string, files: Record<string, string> = {}) {
  const document = parse(source, { uri: HERE }).ast;
  const graphIo = io(files);
  const { modules, unreadable } = await resolveImports({ document, uri: HERE, io: graphIo });
  const graph = { modules, resolve: graphIo.resolve };
  return checkImports({ document, uri: HERE, graph, registry: REGISTRY, unreadable });
}

/**
 * A path that led nowhere.
 *
 * The walk resolved it and asked for it, and nothing answered. Until this, the
 * module simply was not there: the namespace read as an empty one, every name
 * off it was `null`, and the failure surfaced at whatever used it, in another
 * file, blaming something else.
 */
describe("an import whose path leads nowhere", () => {
  it("is reported at the import that wrote it", async () => {
    const found = await problems('import * as cart from "./cart.vn"');

    expect(found.map((one) => one.code)).toEqual(["VN2019"]);
    expect(found[0]?.title).toBe('Nothing to import from "./cart.vn".');
  });

  /** The gap between what was written and where it led is the mistake. */
  it("says which path was tried", async () => {
    const [found] = await problems('import * as cart from "./cart.vn"');

    expect(found?.help).toBe("Nothing was read at /app/cart.vn.");
  });

  it("reports every one of them, not the first", async () => {
    const source = 'import * as a from "./a.vn"\nimport * as b from "./b.vn"';

    expect((await problems(source)).map((one) => one.code)).toEqual(["VN2019", "VN2019"]);
  });

  it("says nothing about a path that leads somewhere", async () => {
    const found = await problems('import { rate } from "./cart.vn"', {
      "/app/cart.vn": "pub const rate = 1",
    });

    expect(found).toEqual([]);
  });

  /** A package is somebody else's question: it is installed or it is not. */
  it("says nothing about a package specifier", async () => {
    expect(await problems('import { http } from "venn/http"')).toEqual([]);
  });

  /**
   * Reported once, in the file that wrote it. A neighbour with a bad import of
   * its own is that neighbour's problem, and drawing it here would put an error
   * on a line that is correct.
   */
  it("is reported in the file that wrote it, and not in the one that imported it", async () => {
    const found = await problems('import { ok } from "./mid.vn"', {
      "/app/mid.vn": 'import * as gone from "./gone.vn"\npub const ok = 1',
    });

    expect(found).toEqual([]);
  });
});
