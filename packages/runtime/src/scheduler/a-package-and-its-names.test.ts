import { parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { createScope, type Scope } from "../scope/index.js";
import { bindImports } from "./bind-imports.js";

const NEWLINE = String.fromCharCode(10);
const URI = "file:///w/main.vn";

/** What Node hands back for a module that is written in ESM. */
const ESM = { nanoid: () => "id", customAlphabet: () => "gen", urlAlphabet: "abc" };

/**
 * What Node hands back for a module that is written in CommonJS.
 *
 * Two keys and no more. The named exports are properties of the object inside,
 * which is the whole of why a named import from one used to bind nothing.
 */
const chunk = (xs: readonly unknown[], size: number): unknown[][] =>
  xs.length > 0 ? [xs.slice(0, size), ...chunk(xs.slice(size), size)] : [];
const inner = Object.assign(() => "called", { chunk, VERSION: "4.17.21" });
const CJS = { default: inner, "module.exports": inner };

/** The names an import puts in scope, given what the package loaded to. */
function bound(source: string, npm: Record<string, Record<string, unknown>>): Scope {
  const { ast } = parse(source, { uri: URI });
  const scope = createScope();
  bindImports({
    document: ast,
    uri: URI,
    scope,
    graph: {
      modules: new Map(),
      resolve: (_from, spec) => spec,
      npm: new Map(Object.entries(npm)),
    },
    base: () => createScope(),
  });
  return scope;
}

/**
 * Every way a program can reach into an npm package.
 *
 * Three of the six answered `null` and one refused to be called, while
 * `venn check` said the file was fine, so the nothing travelled until it
 * reached arithmetic. A language whose whole plugin story is JavaScript cannot
 * have the ordinary spelling of a JavaScript import be the broken one.
 */
describe("the names an npm package puts in scope", () => {
  it("binds a named export of an ESM package", () => {
    const scope = bound('import { nanoid } from "nanoid"', { nanoid: ESM });

    expect(typeof scope.lookup("nanoid")).toBe("function");
  });

  it("binds a named export of a CommonJS package, which is inside `default`", () => {
    const scope = bound('import { chunk } from "lodash"', { lodash: CJS });

    expect(scope.lookup("chunk")).toBe(chunk);
  });

  it("binds a value that is not a function just as it is", () => {
    const scope = bound('import { VERSION } from "lodash"', { lodash: CJS });

    expect(scope.lookup("VERSION")).toBe("4.17.21");
  });

  it("takes the name the import renamed it to", () => {
    const scope = bound('import { chunk as pieces } from "lodash"', { lodash: CJS });

    expect(scope.lookup("pieces")).toBe(chunk);
    expect(scope.lookup("chunk")).toBeUndefined();
  });

  /** The namespace wins where both have a name: an ESM package has it at the top. */
  it("gathers the whole surface behind a wildcard, CommonJS included", () => {
    const scope = bound('import * as l from "lodash"', { lodash: CJS });
    const surface = scope.lookup("l") as Record<string, unknown>;

    expect(Object.keys(surface).sort()).toEqual(["VERSION", "chunk", "default", "module.exports"]);
  });

  /**
   * The default is bound unwrapped. A package's default is very often a
   * callable carrying its whole library as properties, and wrapping it to make
   * it callable would hide every one of them.
   */
  it("binds the default as the host value itself", () => {
    const scope = bound('import lodash from "lodash"', { lodash: CJS });

    expect(scope.lookup("lodash")).toBe(inner);
  });

  it("binds nothing for a package this run did not load", () => {
    const scope = bound('import { chunk } from "lodash"', {});

    expect(scope.lookup("chunk")).toBeUndefined();
  });

  it("leaves a name the package does not carry unbound, for the check to report", () => {
    const scope = bound(['import { chunk, nope } from "lodash"'].join(NEWLINE), { lodash: CJS });

    expect(scope.lookup("chunk")).toBe(chunk);
    expect(scope.lookup("nope")).toBeUndefined();
  });
});
