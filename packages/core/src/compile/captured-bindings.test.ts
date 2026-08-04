import { describe, expect, it } from "vitest";
import { callClosure, type EvalEnv } from "../expr/index.js";
import type { Document, FnDecl } from "../generated/ast.js";
import { parse } from "../parse/index.js";
import { closureOfDecl } from "./compile.js";

const NEWLINE = String.fromCharCode(10);

/** Call the first `fn` of a program, which is where each case writes its body. */
function run(...lines: string[]): unknown {
  const program = parse(lines.join(NEWLINE)).ast as Document;
  const env: EvalEnv = { lookup: () => undefined };
  return callClosure(closureOfDecl(program.decls[0] as FnDecl, env), []);
}

/** One `fn made()` around the statements of a case. */
function made(...lines: string[]): unknown {
  return run("fn made() {", ...lines, "}");
}

function theBlockItWasWrittenIn(): void {
  const answer = made(
    '  let x = "outer"',
    "  if true {",
    '    let x = "inner"',
    "    let seeIt = fn () => x",
    "    return seeIt()",
    "  }",
    '  return "never"',
  );

  expect(answer).toBe("inner");
}

function theOuterOneWhenWrittenBeforeTheBlock(): void {
  const answer = made(
    '  let x = "outer"',
    "  let seeIt = fn () => x",
    "  if true {",
    '    let x = "inner"',
    '    return "${seeIt()} while the block held ${x}"',
    "  }",
    '  return "never"',
  );

  expect(answer).toBe("outer while the block held inner");
}

/** A closure that writes, from inside the block that shadowed the name. */
const WRITTEN_IN_THE_BLOCK = [
  '  let x = "outer"',
  '  let said = ""',
  "  if true {",
  '    let x = "inner"',
  "    let setIt = fn () {",
  '      x = "written"',
  '      return "ran"',
  "    }",
  '    said = "${setIt()} inner=${x}"',
  "  }",
  '  return "${said} outer=${x}"',
];

function writtenThroughAndStillTheBlocks(): void {
  expect(made(...WRITTEN_IN_THE_BLOCK)).toBe("ran inner=written outer=outer");
}

/** Every pass of a loop, capturing the name that pass's binding gave. */
function eachPass(loop: string, of: string): unknown {
  return made(
    "  let out = []",
    `  ${loop} {`,
    `    out = out.push(fn () => ${of})`,
    "    continue",
    "  }",
    '  return "${out[0]()} ${out[1]()} ${out[2]()}"',
  );
}

function thePassThatBoundIt(): void {
  expect(eachPass("forEach n in [1, 2, 3]", "n")).toBe("1 2 3");
  expect(eachPass("repeat 3 as i", "i")).toBe("1 2 3");
}

function theLoopStateThatOutlivesItsLoop(): void {
  const answer = made(
    "  let out = []",
    "  loop n = 0 {",
    "    if n == 3 { break }",
    "    out = out.push(fn () => n)",
    "    continue n + 1",
    "  }",
    '  return "${out[0]()} ${out[1]()} ${out[2]()} after=${n}"',
  );

  expect(answer).toBe("0 1 2 after=3");
}

function whatAPatternBound(): void {
  const answer = made(
    "  let out = []",
    "  forEach n in [1, 2] {",
    "    let [a, b] = [n, n * 10]",
    "    out = out.push(fn () => a + b)",
    "  }",
    '  return "${out[0]()} ${out[1]()}"',
  );

  expect(answer).toBe("11 22");
}

function theParameterOfThatCall(): void {
  const answer = made(
    "  let build = fn (base) => fn () => base",
    '  return "${build(1)()} ${build(2)()}"',
  );

  expect(answer).toBe("1 2");
}

function whatTheMatchArmBound(): void {
  const answer = made(
    "  let out = []",
    "  forEach n in [1, 2] {",
    "    let keep = fn (e) => match e { [a] => fn () => a }",
    "    out = out.push(keep([n]))",
    "  }",
    '  return "${out[0]()} ${out[1]()}"',
  );

  expect(answer).toBe("1 2");
}

function aLoopThatCapturesNothing(): void {
  const answer = made(
    "  let total = 0",
    "  forEach x in [1, 2, 3] {",
    "    let y = x * 2",
    "    total = total + y",
    "  }",
    "  return total",
  );

  expect(answer).toBe(12);
}

/**
 * Which binding a `fn` reads is settled by where it is written.
 *
 * The corpus holds the same programs and compares them against the scheduler,
 * which is the assertion that matters. These are the parts of the compiled path
 * that answer for themselves: the block a closure sits in, the pass that bound
 * the name, and the places a binding is filled from that have no `let` of their
 * own.
 */
describe("a binding a closure captured", () => {
  it("is the one the block it was written in had", theBlockItWasWrittenIn);
  it("is the outer one for a closure written before it", theOuterOneWhenWrittenBeforeTheBlock);
  it("is written through, and is still the block's", writtenThroughAndStillTheBlocks);
  it("is the one that pass bound, in a `forEach` and a `repeat`", thePassThatBoundIt);
  it("is that pass's `loop` state, which outlives the loop", theLoopStateThatOutlivesItsLoop);
  it("is that pass's name, where a pattern bound it", whatAPatternBound);
  it("is that call's parameter, which the caller wrote itself", theParameterOfThatCall);
  it("is that arm's name, where a `match` bound it", whatTheMatchArmBound);
  it("costs a loop that captures nothing no cell at all", aLoopThatCapturesNothing);
});

function reachesTwoBodiesOut(): void {
  const answer = made(
    '  let far = "two out"',
    "  let middle = fn () {",
    "    let inner = fn () => far",
    "    return inner()",
    "  }",
    "  return middle()",
  );

  expect(answer).toBe("two out");
}

function keepsReadingAfterAWrite(): void {
  const answer = made(
    '  let far = "first"',
    "  let seeIt = fn () => far",
    '  far = "second"',
    "  return seeIt()",
  );

  expect(answer).toBe("second");
}

/**
 * A closure two bodies down reaches a name through the free list of the body
 * between, which is what lets it arrive without walking a chain of frames at
 * every call.
 */
describe("where else a captured name lives", () => {
  it("reaches a name two bodies out, through the free list between", reachesTwoBodiesOut);
  it("keeps reading it after the name it came from is written again", keepsReadingAfterAWrite);
});
