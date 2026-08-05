import { ConsolePort, createMemoryConsole, createTestHost } from "@venn-lang/contracts";
import { checkTypes, parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/create-runner.js";

const NEWLINE = String.fromCharCode(10);

/** A whole program, run for what it prints. */
async function run(source: string): Promise<string[]> {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  const console = createMemoryConsole();
  const runner = createRunner({
    host: createTestHost(),
    plugins: [],
    sink: createMemorySink(),
    ports: [{ port: ConsolePort, impl: console }],
  });
  await runner.script(ast);
  return console.out.split(NEWLINE).filter((line) => line !== "");
}

/** The same, in test mode, with every event as text so a refusal can be read. */
async function events(source: string): Promise<string> {
  const sink = createMemorySink();
  const runner = createRunner({
    host: createTestHost(),
    plugins: [],
    sink,
    ports: [{ port: ConsolePort, impl: createMemoryConsole() }],
  });
  await runner.run(parse(source).ast);
  return JSON.stringify(sink.envelopes);
}

function titles(source: string): string[] {
  return checkTypes(parse(source).ast).problems.map((problem) => problem.title);
}

/**
 * Every host name the two spellings used to disagree about, and the members
 * each value really has, on the same lines.
 */
const BOTH_SPELLINGS = [
  "const m = { k: 1 }",
  "const xs = [1, 2]",
  "const d = 300ms",
  'const p = regex(r"d+")',
  'print m["toString"]',
  'print m["constructor"]',
  'print xs["length"]',
  'print d["kind"]',
  'print p["compiled"]',
  'print m["k"]',
  "print m.k",
  'print xs["push"](3)',
  "print xs.push(3)",
  "print xs[1]",
  "print d.ms",
].join(NEWLINE);

const LOOKS_LIKE_A_SIZE = [
  'const m = { kind: "size", label: "x" }',
  "print typeOf(m)",
  "print m.label",
  'print m["label"]',
  "print m.kind",
  "print m",
].join(NEWLINE);

const EVERY_KIND = [
  "print typeOf(null)",
  "print typeOf(true)",
  "print typeOf(1)",
  'print typeOf("a")',
  "print typeOf([1])",
  "print typeOf({ a: 1 })",
  "print typeOf(fn () => 1)",
  "print typeOf(300ms)",
  "print typeOf(2mb)",
  "print typeOf(50%)",
  "print typeOf(2026-07-27T12:00:00Z)",
  'print typeOf(regex(r"d"))',
  "print typeOf(spawn(fn () => 1))",
].join(NEWLINE);

/** The chain from #251, which needs a place to write into and no longer has one. */
const THE_CHAIN = [
  'flow "f" {',
  '  step "s" {',
  "    const m = { a: 1 }",
  '    m["constructor"]["prototype"]["pwned"] = 7',
  "  }",
  "}",
].join(NEWLINE);

const WRITTEN_IN_A_FN = [
  "fn poison(m) {",
  "  m.constructor = 7",
  "  return m",
  "}",
  "print poison({ a: 1 })",
].join(NEWLINE);

const WRITTEN_IN_A_STEP = [
  'flow "f" {',
  '  step "s" {',
  "    const m = { a: 1 }",
  '    m["__proto__"] = 7',
  "  }",
  "}",
].join(NEWLINE);

/**
 * `m.k` and `m[k]` are one question, asked twice.
 *
 * They were two readers. The bracket one had no fences at all, so it handed out
 * whatever the host stored: `m["toString"]` was a callable while `m.toString`
 * was already null, `xs["push"]` was `Array.prototype.push` while `xs.push` was
 * Venn's own, and `d["kind"]` answered `"duration"`, which is the exact leak
 * the dotted read exists to prevent. Written as a comparison wherever the two
 * spellings should agree, since agreement is the thing being held.
 */
describe("one way to read a value", () => {
  it("gives the host's own names to neither spelling", async () => {
    expect(await run(BOTH_SPELLINGS)).toEqual([
      "null",
      "null",
      "null",
      "null",
      "null",
      "1",
      "1",
      "[1, 2, 3]",
      "[1, 2, 3]",
      "2",
      "300",
    ]);
  });

  /**
   * `kind` is how this language spells a union, so people write maps like this
   * one. All five answers used to disagree with each other about it.
   */
  it("calls a map that carries a kind a map", async () => {
    expect(await run(LOOKS_LIKE_A_SIZE)).toEqual([
      "map",
      "x",
      "x",
      "size",
      '{ kind: "size", label: "x" }',
    ]);
    expect(titles('const m = { kind: "size", label: "x" }\nconst t: string = m.label')).toEqual([]);
  });

  /** `typeOf` answers from the closed set, never a name off the value itself. */
  it("names every kind the language has", async () => {
    expect(await run(EVERY_KIND)).toEqual([
      "null",
      "bool",
      "number",
      "string",
      "list",
      "map",
      "fn",
      "duration",
      "size",
      "percent",
      "instant",
      "regex",
      "task",
    ]);
  });

  /** One writer: `pretty` used to answer with the interpreter's own storage. */
  it("shows a unit the same way print does", async () => {
    const shown = await run("print pretty(250ms)\nprint 250ms\nprint pretty({ t: 250ms })");

    expect(shown).toEqual(['"250ms"', "250ms", "{", '  "t": "250ms"', "}"]);
  });

  it("leaves the chain from #251 nowhere to write", async () => {
    expect(await events(THE_CHAIN)).toContain("VN3021");
    expect(({} as Record<string, unknown>).pwned).toBe(undefined);
  });

  /** Both halves of assignment, refused with one sentence. */
  it("refuses a reserved key, compiled and scheduled alike", async () => {
    await expect(run(WRITTEN_IN_A_FN)).rejects.toThrow(
      "`constructor` is not a key you can write to.",
    );
    const said = await events(WRITTEN_IN_A_STEP);

    expect(said).toContain("VN3023");
    expect(said).toContain("`__proto__` is not a key you can write to.");
  });

  /** An index read is typed the way the member read of the same key is. */
  it("checks a written key rather than shrugging at it", () => {
    const shape = ["type P { name: string }", "const p: P = { name: 'a' }"].join(NEWLINE);

    expect(titles(`${shape}\nconst t: number = p['name']`)).toEqual(
      titles(`${shape}\nconst t: number = p.name`),
    );
    expect(titles(`${shape}\nconst t = p['nope']`)).toEqual([
      'Type { name: string } has no field "nope".',
    ]);
  });

  /** A task had no type at all, so `job.dnoe` was silent and nothing completed. */
  it("types what spawn hands back", async () => {
    expect(titles("const j = spawn(fn () => 1)\nprint j.done")).toEqual([]);
    expect(titles("const j = spawn(fn () => 1)\nprint j.dnoe")[0]).toContain(
      'has no member "dnoe"',
    );

    const settled = ["const j = spawn(fn () => 1)", "print j.wait"].join(NEWLINE);
    const shown = await run(`${settled}\nprint j['done']\nprint j.done`);

    expect(shown).toEqual(["1", "true", "true"]);
  });
});
