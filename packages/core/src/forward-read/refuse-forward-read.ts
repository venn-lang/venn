import { walkAst } from "../ast/index.js";
import { buildProblem, CODES } from "../codes/index.js";
import type { Document, FnExpr } from "../generated/ast.js";
import * as ast from "../generated/ast.js";
import { fileOf } from "../parse/index.js";
import { type Problem, ProblemError } from "../problem/index.js";
import type { ForwardRead } from "./forward-read.types.js";
import { forwardReads } from "./forward-reads.js";

/**
 * The sentence, said once.
 *
 * The checker reports this before anything runs and the compiler raises it where
 * the closure is built, so a program stopped by one and a program stopped by the
 * other read alike.
 *
 * @param name The name read too early.
 * @returns The title both paths report it under.
 */
export function readBeforeBound(name: string): string {
  return `\`${name}\` is read here, above the \`let\` that binds it.`;
}

const HELP =
  "Move the binding above this, or read the name below it. A closure reaches the binding in view where it is written, and there is none yet.";

/**
 * Every closure in a file written above a binding it reads, refused where it is
 * written.
 *
 * A name read before it is bound has no binding to mean, and answering with the
 * one below is a guess: the compiled body and the interpreted one guessed
 * differently, and inside a loop pass both were wrong. Saying so here is what
 * makes the four ways a body can be written agree.
 *
 * @param args The parsed file, and the uri its spans point at.
 * @returns One problem per read, each at the name it points at.
 */
export function forwardReadProblems(args: { document: Document; uri: string }): Problem[] {
  const found: Problem[] = [];
  for (const node of walkAst(args.document)) {
    if (ast.isFnExpr(node)) found.push(...forwardReads(node, args.uri).map(refuse));
  }
  return found;
}

/**
 * The same refusal, raised while the closure is compiled.
 *
 * This is what stops the evaluator carrying on regardless, which it used to: the
 * closure was built, `Frame.lookup` searched the body's names when it was called,
 * and which binding it found depended on which of the two evaluators ran it.
 *
 * @param fn The closure being compiled.
 * @throws ProblemError `VN2026` when the closure reads a name bound below it.
 */
export function refuseForwardReads(fn: FnExpr): void {
  const [first] = forwardReads(fn, fileOf(fn));
  if (first) throw new ProblemError(refuse(first));
}

function refuse(read: ForwardRead): Problem {
  return buildProblem({
    spec: CODES.VN2026_READ_BEFORE_BOUND,
    span: read.span,
    title: readBeforeBound(read.name),
    help: HELP,
  });
}
