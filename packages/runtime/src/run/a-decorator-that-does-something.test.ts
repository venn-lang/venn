import { ConsolePort, createMemoryConsole, createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "./create-runner.js";

const NEWLINE = String.fromCharCode(10);

/** Every line a program printed, running it in script mode. */
async function run(source: string): Promise<string[]> {
  const { ast, problems } = parse(source);
  expect(problems.map((one) => one.title)).toEqual([]);
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

/**
 * What a decorator written in Venn can do, now that a hook runs in the program.
 *
 * A `deco` body still runs before the program exists and still cannot reach the
 * world: it rewrites a declaration and nothing else. A hook is not the body. It
 * is a value handed to `wrap`, `before` or `after`, kept, and called once the
 * program is running, and every one of these was refused for a moment it was
 * not running in.
 */
describe("a hook a decorator left behind", () => {
  it("calls a verb, which is what a logging decorator is", async () => {
    const source = [
      "deco logged(target: Fn) {",
      "  target.wrap(fn (call, args) {",
      '    print "calling ${target.name}"',
      "    call(args)",
      "  })",
      "}",
      "@logged",
      'fn ping() => "pong"',
      "print ping()",
    ];

    expect(await run(source.join(NEWLINE))).toEqual(["calling ping", "pong"]);
  });

  it("reads a name the program bound, not only one the decorator did", async () => {
    const source = [
      'const site = "eu-west"',
      "deco tagged(target: Fn) {",
      '  target.wrap(fn (call, args) => "[${site}] ${call(args)}")',
      "}",
      "@tagged",
      'fn ping() => "pong"',
      "print ping()",
    ];

    expect(await run(source.join(NEWLINE))).toEqual(["[eu-west] pong"]);
  });

  /** The shape a cooldown has: state that belongs to the decoration itself. */
  it("counts in a `let` of the decorator's own, across calls", async () => {
    const source = [
      "deco cooldown(target: Fn, times: number) {",
      "  let calls = 0",
      "  target.wrap(fn (call, args) {",
      "    calls = calls + 1",
      '    if calls > times { fail "on cooldown" { code: "cd" } }',
      "    call(args)",
      "  })",
      "}",
      "@cooldown(2)",
      'fn ping() => "pong"',
      "print ping()",
      "print ping()",
      "print (try ping() catch e => e.code)",
    ];

    expect(await run(source.join(NEWLINE))).toEqual(["pong", "pong", "cd"]);
  });

  it("writes a name the program bound, so two decorations share a count", async () => {
    const source = [
      "let seen = 0",
      "deco counted(target: Fn) {",
      "  target.wrap(fn (call, args) {",
      "    seen = seen + 1",
      "    call(args)",
      "  })",
      "}",
      "@counted",
      'fn ping() => "pong"',
      "@counted",
      'fn pong() => "ping"',
      "print ping()",
      "print pong()",
      'print "seen: ${seen}"',
    ];

    expect(await run(source.join(NEWLINE))).toEqual(["pong", "ping", "seen: 2"]);
  });

  /** `before` and `after` are the same value in a different place on the node. */
  it("runs a verb from `before` and from `after` too", async () => {
    const source = [
      "deco traced(target: Fn) {",
      "  target.before(fn (args) {",
      '    print "in"',
      "    args",
      "  })",
      "  target.after(fn (args, result) {",
      '    print "out ${result}"',
      "    result",
      "  })",
      "}",
      "@traced",
      'fn ping() => "pong"',
      "print ping()",
    ];

    expect(await run(source.join(NEWLINE))).toEqual(["in", "out pong", "pong"]);
  });
});
