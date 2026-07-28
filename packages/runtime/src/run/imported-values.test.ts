import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "./create-runner.js";
import { type ModuleIo, resolveImports } from "./resolve-imports.js";

const LIB: Record<string, string> = {
  "/base.vn": `const FATOR = 3
fn privado(x: number) -> number => x * FATOR
pub fn triplo(x: number) -> number => privado(x)`,
  "/meio.vn": `import { triplo } from "./base.vn"
pub fn seis(x: number) -> number => triplo(x) * 2`,
  "/a.vn": `import { b } from "./b.vn"
pub fn a(n: number) -> number => n <= 0 ? 0 : b(n - 1) + 1`,
  "/b.vn": `import { a } from "./a.vn"
pub fn b(n: number) -> number => n <= 0 ? 0 : a(n - 1) + 1`,
};

const io: ModuleIo = {
  read: async (uri) => LIB[uri] ?? Promise.reject(new Error("not found")),
  resolve: (_from, spec) => spec.replace(/^\./, ""),
};

/** Run a program; give back what it logged and whether it got there. */
async function ran(source: string): Promise<{ logs: string[]; failed: number }> {
  const { ast, problems } = parse(source, { uri: "/main.vn" });
  expect(problems).toEqual([]);
  const resolved = await resolveImports({ document: ast, uri: "/main.vn", io });
  const sink = createMemorySink();
  const runner = createRunner({
    host: createTestHost(),
    plugins: [],
    sink,
    uri: "/main.vn",
    moduleFragments: resolved.fragments,
    modules: { modules: resolved.modules, resolve: io.resolve },
  });
  const result = await runner.script(ast);
  const logs = sink.envelopes
    .filter((event) => event.kind === "log")
    .map((event) => String((event.data as { message?: unknown }).message ?? ""));
  return { logs, failed: result.failed };
}

async function printed(source: string): Promise<string[]> {
  return (await ran(source)).logs;
}

/**
 * Calling a function another file published.
 *
 * The name bound nothing: the import resolved, the checker said the file was
 * fine, and the call failed at run time with "this value is not a function".
 * A `pub fn` is a closure over the file it was written in, so each module gets
 * a scope of its own and the importer takes only what it asked for out of it.
 */
describe("a function imported from another file", () => {
  it("is callable", async () => {
    const source = ['import { triplo } from "./base.vn"', "log triplo(2)"].join("\n");

    expect(await printed(source)).toEqual(["6"]);
  });

  /** It runs where it was written: its own file's private helpers and globals. */
  it("still reaches the private helpers of its own file", async () => {
    const source = ['import { triplo } from "./base.vn"', "log triplo(1)"].join("\n");

    expect(await printed(source)).toEqual(["3"]);
  });

  it("works through a file that imported it in turn", async () => {
    const source = ['import { seis } from "./meio.vn"', "log seis(1)"].join("\n");

    expect(await printed(source)).toEqual(["6"]);
  });

  /**
   * Two files that call each other are ordinary, and no order resolves them one
   * at a time: following the imports leaves the second reading `undefined`.
   */
  it("works when two files import each other", async () => {
    const source = ['import { a } from "./a.vn"', "log a(5)"].join("\n");

    expect(await printed(source)).toEqual(["5"]);
  });

  it("binds everything published under one name with `* as`", async () => {
    const source = ['import * as tudo from "./base.vn"', "log tudo.triplo(3)"].join("\n");

    expect(await printed(source)).toEqual(["9"]);
  });

  /** A local declaration of the same name wins, the rule fragments follow. */
  it("gives way to a local name of the same spelling", async () => {
    const source = [
      'import { triplo } from "./base.vn"',
      "fn triplo(x: number) -> number => 999",
      "log triplo(1)",
    ].join("\n");

    expect(await printed(source)).toEqual(["999"]);
  });

  /**
   * Only what the module offered. Reaching a private name would work and then
   * stop working the day that file rearranged its own insides.
   */
  it("does not hand over a name the other file kept private", async () => {
    const source = ['import { privado } from "./base.vn"', "log 1"].join("\n");

    expect(await printed(source)).toEqual(["1"]);
  });
});
