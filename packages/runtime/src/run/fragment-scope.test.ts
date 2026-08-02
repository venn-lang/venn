import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "./create-runner.js";
import { type ModuleIo, resolveImports } from "./resolve-imports.js";

const NEWLINE = String.fromCharCode(10);

const LIB: Record<string, string> = {
  "/greet.vn": `const who = "the module"
pub fragment hello() {
  log "hello from \${who}"
}`,
  "/counter.vn": `let seen = 0
pub fragment count() {
  seen = seen + 1
  log "seen \${seen}"
}`,
};

const io: ModuleIo = {
  read: async (uri) => LIB[uri] ?? Promise.reject(new Error("not found")),
  resolve: (_from, spec) => spec.replace(/^\./, ""),
};

/** Run a program and give back what it logged. */
async function ran(lines: string[]): Promise<string[]> {
  const source = lines.join(NEWLINE);
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
  await runner.script(ast);
  return sink.envelopes
    .filter((event) => event.kind === "log")
    .map((event) => String((event.data as { message?: unknown }).message ?? ""));
}

/**
 * What a fragment can see.
 *
 * Its scope was built from nothing, so the file's bindings, one link away, were
 * out of reach and read as `null`. A `fn` written beside it is a closure over
 * the file, and a fragment was not, for no reason anybody wrote down.
 */
describe("a fragment and the file it was written in", () => {
  it("reads what the file bound", async () => {
    const lines = [
      "const limit = 7",
      "fragment show() {",
      '  log "limit is ${limit}"',
      "}",
      "run show()",
    ];

    expect(await ran(lines)).toEqual(["limit is 7"]);
  });

  it("reads a function the file declared", async () => {
    const lines = [
      "fn double(n) => n * 2",
      "fragment show() {",
      '  log "${double(21)}"',
      "}",
      "run show()",
    ];

    expect(await ran(lines)).toEqual(["42"]);
  });

  /** The test dropped from #158, which needed this to be true first. */
  it("writes the file's binding, not a local of its own", async () => {
    const lines = [
      "let seen = 0",
      "fragment tick() {",
      "  seen = seen + 1",
      "}",
      "run tick()",
      "run tick()",
      'log "${seen}"',
    ];

    expect(await ran(lines)).toEqual(["2"]);
  });

  /** Its own scope on top of the file's, so what a caller bound stays there. */
  it("does not read a local of whoever called it", async () => {
    const lines = [
      "fragment inner() {",
      '  log "reached: ${hidden != null}"',
      "}",
      "fragment outer() {",
      '  const hidden = "the caller\'s"',
      "  run inner()",
      "}",
      "run outer()",
    ];

    expect(await ran(lines)).toEqual(["reached: false"]);
  });

  it("gets a fresh scope each time it is run", async () => {
    const lines = [
      "fragment once() {",
      "  let count = 0",
      "  count = count + 1",
      '  log "${count}"',
      "}",
      "run once()",
      "run once()",
    ];

    expect(await ran(lines)).toEqual(["1", "1"]);
  });
});

describe("a fragment that came from another file", () => {
  it("reads that file's bindings, not the caller's", async () => {
    const lines = ['import { hello } from "./greet.vn"', 'const who = "the caller"', "run hello()"];

    expect(await ran(lines)).toEqual(["hello from the module"]);
  });

  it("writes that file's bindings, and keeps them between calls", async () => {
    const lines = ['import { count } from "./counter.vn"', "run count()", "run count()"];

    expect(await ran(lines)).toEqual(["seen 1", "seen 2"]);
  });
});
