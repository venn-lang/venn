import { createTestHost } from "@venn/contracts";
import { parse } from "@venn/core";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "./create-runner.js";
import { type ModuleIo, resolveImports } from "./resolve-imports.js";

describe("resolveImports (multi-file)", () => {
  it("loads an imported pub fragment and makes it runnable", async () => {
    const sources: Record<string, string> = {
      "/lib.vn": `module lib
pub fragment greet(name) {
  step "greet" { expect name == "world" }
}`,
    };
    const io: ModuleIo = {
      read: async (uri) => sources[uri] ?? Promise.reject(new Error("not found")),
      resolve: (_base, spec) => (spec === "./lib.vn" ? "/lib.vn" : spec),
    };

    const mainSource = `module main
import { greet } from "./lib.vn"

flow "F" {
  run greet("world")
}`;
    const { ast, problems } = parse(mainSource, { uri: "/main.vn" });
    expect(problems).toEqual([]);

    const { fragments: moduleFragments } = await resolveImports({
      document: ast,
      uri: "/main.vn",
      io,
    });
    expect(moduleFragments.has("greet")).toBe(true);

    const runner = createRunner({
      host: createTestHost(),
      plugins: [],
      sink: createMemorySink(),
      moduleFragments,
    });
    const result = await runner.run(ast);

    expect(result.failed).toBe(0);
    expect(result.passed).toBe(1);
  });
});

/**
 * `pub` on a `deco` has to mean what it means everywhere else. It parsed from
 * the first day and reached nobody: a file that imported one was told no
 * decorator had that name, which is the language contradicting its own keyword.
 */
describe("resolveImports (a pub deco)", () => {
  const LIB = `module lib
pub deco off(target: Flow) { target.meta "skip" true }
pub deco shout(target: Fn) { target.rename "louder" }
deco hidden(target: Fn) { target.rename "no" }`;

  const io: ModuleIo = {
    read: async (uri) => (uri === "/lib.vn" ? LIB : Promise.reject(new Error("not found"))),
    resolve: (_base, spec) => (spec === "./lib.vn" ? "/lib.vn" : spec),
  };

  async function runMain(body: string) {
    const source = `module main\nimport { off } from "./lib.vn"\n\n${body}`;
    const { ast, problems } = parse(source, { uri: "/main.vn" });
    expect(problems).toEqual([]);
    const { decos } = await resolveImports({ document: ast, uri: "/main.vn", io });
    const runner = createRunner({
      host: createTestHost(),
      plugins: [],
      sink: createMemorySink(),
      uri: "/main.vn",
      moduleDecos: decos,
    });
    return { decos, result: await runner.run(ast) };
  }

  it("collects only what the other file marked `pub`, with the file it came from", async () => {
    const { decos } = await runMain('flow "F" { expect true }');

    expect([...decos.keys()].sort()).toEqual(["off", "shout"]);
    expect(decos.get("off")?.uri).toBe("/lib.vn");
  });

  it("applies it: the imported `@off` really keeps the flow from running", async () => {
    const { result } = await runMain('@off\nflow "F" { expect false }\n\nflow "G" { expect true }');

    expect(result.problems).toEqual([]);
    expect(result.failed).toBe(0);
    expect(result.passed).toBe(1);
  });

  it("checks the imported signature at the use site", async () => {
    const { result } = await runMain('@off\nfn f(n) => n\n\nflow "G" { expect true }');

    expect(result.problems?.map((one) => one.code)).toEqual(["VN2014"]);
    expect(result.problems?.[0]?.title).toBe("@off decorates a flow, and this is a function.");
  });
});
