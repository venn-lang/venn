import { ConsolePort, createMemoryConsole, createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { buildRegistry } from "../registry/index.js";
import { createRunner } from "../run/index.js";
import { collectFragments } from "../scheduler/index.js";
import { checkDocument } from "./check-document.js";

const NEWLINE = String.fromCharCode(10);

/** What `net.fetch` was handed, read by the test rather than by the program. */
const reached: string[] = [];

/** A verb whose plugin asks the host for something, so it does reach outward. */
const NET = definePlugin({
  name: "@t/net",
  namespace: "net",
  requires: ["net"],
  actions: [
    defineAction({
      name: "fetch",
      run: (_ctx, call) => {
        reached.push(String(call.args[0]));
        return `got ${call.args[0]}`;
      },
    }),
  ],
});

const IMPORT = 'import { net } from "@t/net"';

/** What the checker said about a program, which is nothing for every row here. */
function titles(source: string): string[] {
  const document = parse(source).ast;
  const registry = buildRegistry({ plugins: [NET], caps: createTestHost().caps });
  const fragments = new Set(collectFragments(document).keys());
  return checkDocument({ document, registry, fragments }).map((one) => one.title);
}

/** Every line a program printed, with `reached` holding what the verb was given. */
async function ran(...lines: string[]): Promise<string[]> {
  reached.length = 0;
  const source = [IMPORT, ...lines, ""].join(NEWLINE);
  expect(titles(source)).toEqual([]);
  const console = createMemoryConsole();
  const runner = createRunner({
    host: createTestHost(),
    plugins: [NET],
    sink: createMemorySink(),
    ports: [{ port: ConsolePort, impl: console }],
  });
  await runner.script(parse(source).ast);
  return console.out.split(NEWLINE).filter((line) => line !== "");
}

/**
 * Every body a verb can be written in, each one reaching the same verb.
 *
 * A lambda is a body like any other, and that is what the old rule could not
 * afford: `["x"].map(fn (n) => net.fetch(n))` was refused and told to move the
 * verb to the top level of a file while already being at the top level of one.
 * The refusal was right about where it stood and the way out it named did not
 * exist.
 *
 * The last four rows were the table `A_VERB_IS_STILL_REFUSED` in
 * `check-document.test.ts`. That table is deleted rather than inverted, because
 * a checker cannot show that a verb ran: `toEqual([])` in its place would pass
 * just as well if the verb compiled to nothing, which is exactly the bug the
 * refusal used to hide. The rows run here instead, and each one asserts the
 * argument the verb was handed.
 */
const EVERY_BODY: Record<string, string[]> = {
  "a lambda handed to a list method": [
    'let rows = ["x"]',
    "let out = rows.map(fn (n) => net.fetch(n))",
    "print out[0]",
  ],
  "the arrow spelling of that lambda, which is the same body": [
    'let rows = ["x"]',
    "let out = rows.map(n => net.fetch(n))",
    "print out[0]",
  ],
  "a lambda nested inside a fn, where the verb is two bodies deep": [
    "fn f(ns) => ns.map(n => net.fetch(n))",
    'let out = f(["x"])',
    "print out[0]",
  ],
  "a fn declared with a block body": ['fn f() { net.fetch("x") }', "print f()"],
  "a fn declared with an expression body": ['fn f() => net.fetch("x")', "print f()"],
  "a `let` taking a trailing argument, which is what makes it a call": [
    "fn f() {",
    '  let a = net.fetch "x"',
    "  return a",
    "}",
    "print f()",
  ],
  "a call standing as a statement, whose value nothing keeps": [
    "fn f() {",
    '  net.fetch "x"',
    "  return 1",
    "}",
    "print f()",
  ],
  "a call read where a value is wanted": [
    "fn f() {",
    '  let a = net.fetch("x")',
    "  return a",
    "}",
    "print f()",
  ],
  "the block an arrow carries, which parses as a body and not as a map": [
    "const f = r => {",
    "  net.fetch r",
    "  1",
    "}",
    'print f("x")',
  ],
};

describe("a verb written inside a body", () => {
  it.each(Object.entries(EVERY_BODY))("runs from %s", async (_name, lines) => {
    await ran(...lines);

    expect(reached).toEqual(["x"]);
  });
});

/**
 * Reaching the world is half of it. The answer has to come back, or a body that
 * called a verb and dropped what it said would pass every row above.
 */
describe("what the verb answered", () => {
  it("is the value of the body that called it", async () => {
    expect(await ran('fn f() => net.fetch("x")', "print f()")).toEqual(["got x"]);
  });

  it("is what a lambda hands back to the method around it", async () => {
    const said = await ran('let out = ["a", "b"].map(n => net.fetch(n))', "print out[1]");

    expect(said).toEqual(["got b"]);
  });
});
