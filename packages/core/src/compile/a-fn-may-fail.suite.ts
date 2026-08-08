import { expect } from "vitest";
import type { Closure, EvalEnv } from "../expr/index.js";
import { callClosure } from "../expr/index.js";
import type { Document, FnDecl } from "../generated/ast.js";
import { isFnDecl } from "../generated/ast.js";
import { parse } from "../parse/index.js";
import { type Caught, caughtValue } from "../problem/index.js";
import { checkTypes } from "../typecheck/index.js";
import { closureOfDecl } from "./compile.js";

const NEWLINE = String.fromCharCode(10);

/**
 * A program written as lines, the way a body has to be.
 *
 * @param lines The lines, in order.
 * @returns The source.
 */
export function program(...lines: string[]): string {
  return lines.join(NEWLINE);
}

/**
 * What the checker said about a program that parses, code and sentence.
 *
 * @param source The program.
 * @returns One string per problem, empty when it checks clean.
 */
function said(source: string): string[] {
  return checkTypes(parsed(source)).problems.map((one) => `${one.code} ${one.title}`);
}

/**
 * Call one of a program's `fn`s without asking the checker anything.
 *
 * @param args.source The program.
 * @param args.name The `fn` to call.
 * @param args.args What to call it with.
 * @returns Whatever it answered, letting whatever it raised out.
 */
function evaluated(args: { source: string; name: string; args?: unknown[] }): unknown {
  const bindings: Record<string, Closure> = {};
  const env: EvalEnv = { lookup: (bound) => bindings[bound] };
  for (const decl of parsed(args.source).decls) {
    if (isFnDecl(decl)) bindings[decl.name] = closureOfDecl(decl as FnDecl, env);
  }
  return callClosure(bindings[args.name] as Closure, args.args ?? []);
}

/**
 * Check a program, then call one of its `fn`s.
 *
 * Running a body proves the body runs, and says nothing about what the checker
 * made of the same program: the two can disagree, since a `try` evaluates to
 * whichever side happened while inference has to name a type covering both. So
 * every row asks both, and the checker first.
 *
 * @param source The program, which must check clean.
 * @param name The `fn` to call.
 * @param args What to call it with.
 * @returns Whatever it answered, letting whatever it raised out.
 */
export function call(source: string, name: string, args: unknown[] = []): unknown {
  expect(said(source)).toEqual([]);
  return evaluated({ source, name, args });
}

/**
 * What a caller reads out of the failure a call to `f` raised.
 *
 * @param source The program, which must check clean.
 * @param args What to call `f` with.
 * @returns The failure as a caller sees it.
 */
export function raised(source: string, args: unknown[] = []): Caught {
  try {
    call(source, "f", args);
  } catch (failure) {
    return caughtValue(failure);
  }
  throw new Error("the call did not raise");
}

/** The tree of a program that parses, with a parse problem failing the row. */
function parsed(source: string): Document {
  const one = parse(source);
  expect(one.problems.map((problem) => problem.title)).toEqual([]);
  return one.ast as Document;
}
