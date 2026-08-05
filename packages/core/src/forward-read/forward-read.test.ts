import { describe, expect, it } from "vitest";
import type { Document } from "../generated/ast.js";
import { parse } from "../parse/index.js";
import { forwardReadProblems } from "./refuse-forward-read.js";

const NEWLINE = String.fromCharCode(10);
const URI = "/main.vn";

/** What the checker says about a program, as `CODE line:column name`. */
function said(...lines: string[]): string[] {
  const document = parse(lines.join(NEWLINE), { uri: URI }).ast as Document;
  return forwardReadProblems({ document, uri: URI }).map(
    (one) => `${one.code} ${one.span.line}:${one.span.column} ${one.title}`,
  );
}

/** Only the codes and places, for the cases whose sentence is not the point. */
function marked(...lines: string[]): string[] {
  return said(...lines).map((one) => one.split(" ").slice(0, 2).join(" "));
}

function theBindingUnderIt(): void {
  expect(said("let see = fn () => later", 'let later = "bound after"')).toEqual([
    "VN2026 1:20 `later` is read here, above the `let` that binds it.",
  ]);
}

/** Two closures deep is one refusal: the inner one owns the read. */
function oneRefusalPerRead(): void {
  expect(marked("let see = fn () => fn () => later", "let later = 1")).toEqual(["VN2026 1:29"]);
}

function theBindingAboveIt(): void {
  expect(marked('let early = "bound before"', "let see = fn () => early")).toEqual([]);
}

/** The `let` a closure sits inside is above it, which is what recursion reads. */
function theBindingItSitsInside(): void {
  expect(marked("let fact = fn (n) => n <= 1 ? 1 : n * fact(n - 1)")).toEqual([]);
}

function itsOwnParameter(): void {
  expect(marked("let twice = fn (n) => n + n", "let n = 4")).toEqual([]);
}

/** The item of the pass around it, which is in view for the whole block. */
function theItemOfThePassAroundIt(): void {
  expect(marked("forEach n in [1, 2] {", "  let see = fn () => n", "}", "let n = 9")).toEqual([]);
}

/** A name bound in a block the closure is not in is not the binding it reads. */
function aBindingInAnotherBlock(): void {
  expect(marked("let see = fn () => hidden", "if true {", "  let hidden = 1", "}")).toEqual([]);
}

/**
 * The nearest binding wins, so a `let` below shadowing one above is still read
 * before it exists rather than resolving outward to the wrong one.
 */
function theNearerBindingEvenWhenOneIsAbove(): void {
  const lines = ["let y = 1", "fn made() {", "  let see = fn () => y", "  let y = 2", "}"];

  expect(marked(...lines)).toEqual(["VN2026 3:22"]);
}

/** A `fn` declaration is bound for the whole file, so its body may look down. */
function aFunctionReadingTheFilesOwnNames(): void {
  const nested = [
    "fn made() {",
    "  let see = fn () => below",
    "  return see()",
    "}",
    "let below = 1",
  ];

  expect(marked(...nested)).toEqual([]);
  expect(marked("fn made() => below", "let below = 1")).toEqual([]);
}

/** The body of one frame, written at the indent the shapes below place it at. */
function closure(indent: string): string {
  return `${indent}let see = fn () => later`;
}

/** What each shape below ends with: the binding, written under the frame. */
const BELOW = ["  let later = 1", "}"];

const ACROSS_A_STEP = ['flow "F" {', '  step "s" {', closure("    "), "  }", ...BELOW];
const ACROSS_A_GROUP = ['flow "F" {', '  group "G" {', closure("    "), "  }", ...BELOW];
const ACROSS_A_HOOK = ['flow "F" {', "  setup {", closure("    "), "  }", ...BELOW];
const INTO_A_GROUP = [
  'flow "F" {',
  '  group "G" {',
  '    step "s" {',
  closure("      "),
  "    }",
  "    let later = 1",
  "  }",
  "}",
];

/**
 * A `flow`, a `step`, a `group` and a lifecycle hook are frames the program
 * runs, not names the file hands out, so a `let` written below one of them is
 * as unbound inside it as the same shape is at the top of a file.
 */
function aBindingBelowTheFrameThatReadsIt(): void {
  expect(marked(...ACROSS_A_STEP)).toEqual(["VN2026 3:24"]);
  expect(marked(...ACROSS_A_GROUP)).toEqual(["VN2026 3:24"]);
  expect(marked(...ACROSS_A_HOOK)).toEqual(["VN2026 3:24"]);
  expect(marked(...INTO_A_GROUP)).toEqual(["VN2026 4:26"]);
}

/**
 * The file's own names are the exception: `bindGlobals` binds every one of them
 * before the first `flow` runs, so a top-level `let` written below a `flow` is
 * in view inside it and reading it there answers 7.
 */
function aTopLevelBindingBelowTheFlowThatReadsIt(): void {
  const hoisted = ['flow "F" {', '  step "s" {', closure("    "), "  }", "}", "let later = 7"];

  expect(marked(...hoisted)).toEqual([]);
}

describe("a name a closure reads", () => {
  it("is refused when the `let` that binds it is written under it", theBindingUnderIt);
  it("is refused once, at the closure that read it", oneRefusalPerRead);
  it("is fine when the binding is written above it", theBindingAboveIt);
  it("is fine when it is the binding the closure is the value of", theBindingItSitsInside);
  it("is fine when the closure binds it itself", itsOwnParameter);
  it("is fine when the pass around it binds it", theItemOfThePassAroundIt);
  it("is left alone when the only binding is in another block", aBindingInAnotherBlock);
  it(
    "is refused against the nearer binding, not the outer one",
    theNearerBindingEvenWhenOneIsAbove,
  );
  it("is left alone across a `fn` declaration's own body", aFunctionReadingTheFilesOwnNames);
});

/**
 * The outward walk ends at the file and nowhere short of it, which is the one
 * boundary the language really has: everything between is a frame the program
 * runs, and only the file's own names are bound before any of them do.
 */
describe("a name a closure reads across a frame", () => {
  it("is refused when the binding is written below the frame", aBindingBelowTheFrameThatReadsIt);
  it("is left alone when the binding is the file's own", aTopLevelBindingBelowTheFlowThatReadsIt);
});
