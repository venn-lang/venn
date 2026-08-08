import { ConsolePort, createMemoryConsole, createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "./create-runner.js";

const NEWLINE = String.fromCharCode(10);

/** Where `world.mark` writes, read by the test rather than by the program. */
const marks: string[] = [];

/**
 * A plugin that reaches the world and takes its time about it.
 *
 * `mark` gives up the turn as many times as it is told before recording, which
 * is a suspension without a clock in it: two calls written slow-then-fast land
 * in written order only if the body waited for the first before starting the
 * second, and land the other way round if it did not.
 */
const WORLD = definePlugin({
  name: "@t/world",
  namespace: "world",
  actions: [
    defineAction({
      name: "mark",
      run: async (_ctx, call) => {
        const turns = Number(call.args[1] ?? 0);
        for (let at = 0; at < turns; at += 1) await Promise.resolve();
        marks.push(String(call.args[0]));
      },
    }),
  ],
});

/** Every line a program printed, running it in script mode. */
async function run(source: string): Promise<string[]> {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  const console = createMemoryConsole();
  const runner = createRunner({
    host: createTestHost(),
    plugins: [WORLD],
    sink: createMemorySink(),
    ports: [{ port: ConsolePort, impl: console }],
  });
  await runner.script(ast);
  return console.out.split(NEWLINE).filter((line) => line !== "");
}

/**
 * What a `fn` may do, now that it may reach the world.
 *
 * Every program here was refused by `VN2024`. They are written as programs
 * rather than as unit tests of the compiler because the rule spanned the
 * checker, the compiler and the scheduler, and a body that compiles is not the
 * claim: the claim is that it runs, and that what it did happened in the order
 * it was written.
 */
describe("a function that reaches the world", () => {
  it("runs a verb written as a statement, and answers after it", async () => {
    const source = [
      "fn shout(word) {",
      '  print "saying ${word}"',
      "  word.upper",
      "}",
      'print shout("hi")',
    ];

    expect(await run(source.join(NEWLINE))).toEqual(["saying hi", "HI"]);
  });

  it("runs one written inside an if, at any depth", async () => {
    const source = [
      "fn tell(n) {",
      "  if n > 1 {",
      '    print "many"',
      "  }",
      "  n",
      "}",
      "print tell(2)",
    ];

    expect(await run(source.join(NEWLINE))).toEqual(["many", "2"]);
  });

  /** The shape the rule cost most: a callback that reaches the world per item. */
  it("runs a verb inside a callback, once per item", async () => {
    const source = [
      'const named = ["a", "b"].map(one => {',
      '  print "saw ${one}"',
      '  "${one}!"',
      "})",
      "print named",
    ];

    expect(await run(source.join(NEWLINE))).toEqual(["saw a", "saw b", '["a!", "b!"]']);
  });

  /** A raise is control flow, so it still leaves rather than answering. */
  it("still raises out of a fn, with the code it was given", async () => {
    const source = [
      "fn guard(n) {",
      '  if n < 0 { fail "negative" { code: "n.neg" } }',
      "  n * 2",
      "}",
      "print guard(3)",
      "print (try guard(-1) catch e => e.code)",
    ];

    expect(await run(source.join(NEWLINE))).toEqual(["6", "n.neg"]);
  });
});

/**
 * The order the statements of a body run in.
 *
 * A compiled body used to evaluate its bindings at once and wait only where one
 * was read, so a slow first line and a fast second finished the wrong way round
 * and the second saw the world as it had been.
 */
describe("statements of a body that reaches the world", () => {
  it("waits for a slow one before starting the next", async () => {
    marks.length = 0;
    const source = [
      "fn both() {",
      '  const a = world.mark("slow", 5)',
      '  const b = world.mark("fast", 0)',
      "  0",
      "}",
      "print both()",
    ];

    await run(source.join(NEWLINE));

    expect(marks).toEqual(["slow", "fast"]);
  });

  it("waits the same way for a verb written as a statement", async () => {
    marks.length = 0;
    const source = [
      "fn both() {",
      '  world.mark "slow" 5',
      '  world.mark "fast" 0',
      "  0",
      "}",
      "print both()",
    ];

    await run(source.join(NEWLINE));

    expect(marks).toEqual(["slow", "fast"]);
  });

  it("waits the same way inside a loop", async () => {
    marks.length = 0;
    const source = [
      "fn each() {",
      '  forEach one in ["slow", "fast"] {',
      '    const turns = one == "slow" ? 5 : 0',
      "    world.mark one turns",
      "  }",
      "  0",
      "}",
      "print each()",
    ];

    await run(source.join(NEWLINE));

    expect(marks).toEqual(["slow", "fast"]);
  });
});
