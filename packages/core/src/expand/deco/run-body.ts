import type { AstNode } from "langium";
import { callArgs } from "../../ast/index.js";
import { buildProblem, CODES } from "../../codes/index.js";
import { evaluate, invoke, memberValue } from "../../expr/index.js";
import type { ActionCall, Block, IfStmt, LetStmt, Statement } from "../../generated/ast.js";
import { patternSlots, slotValue } from "../../pattern/index.js";
import { type Problem, ProblemError } from "../../problem/index.js";
import { truthy } from "../../value/index.js";
import { handleSurface, missingVerb } from "../handles/index.js";
import { spanOf } from "../node-span.js";
import type { DecoBodyArgs } from "./deco.types.js";

/**
 * Run a decorator's body, at expansion time, over the handle it was given.
 *
 * It understands `let`/`const`, `if`, and a call on something it can already
 * see. Nothing else, because nothing else exists yet: a call whose head it
 * cannot find is a plugin's verb, and saying so is more use than a lookup that
 * quietly yields nothing and a `TypeError` two lines later.
 *
 * Nothing is thrown. Every refusal reaches `args.reject` as a `Problem` pointing
 * at the statement that caused it.
 */
export function runDecoBody(args: DecoBodyArgs): void {
  runStmts(args.body.stmts, args);
}

function runStmts(stmts: readonly Statement[], args: DecoBodyArgs): void {
  for (const stmt of stmts) {
    try {
      dispatch(stmt, args);
    } catch (error) {
      args.reject(located(error, stmt, args.uri));
    }
  }
}

function dispatch(stmt: Statement, args: DecoBodyArgs): void {
  if (stmt.$type === "LetStmt") {
    bind(stmt as LetStmt, args);
  } else if (stmt.$type === "ActionCall") {
    callVerb(stmt as ActionCall, args);
  } else if (stmt.$type === "IfStmt") {
    branch(stmt as IfStmt, args);
  } else {
    throw refuse(UNSUPPORTED);
  }
}

/** `const cache = {}`. Trailing arguments would make it an action, which it cannot be. */
function bind(stmt: LetStmt, args: DecoBodyArgs): void {
  if (stmt.args.length > 0 || stmt.opts) throw refuse(IMPURE_LET);
  const value = evaluate(stmt.value, args.env);
  if (stmt.name) return void args.env.bind(stmt.name, value);
  for (const bound of stmt.pattern ? patternSlots(stmt.pattern) : []) {
    args.env.bind(bound.name, slotValue(value, bound));
  }
}

/** `target.wrap(f)`, `target.meta "retry" 3`: a verb on something already in hand. */
function callVerb(stmt: ActionCall, args: DecoBodyArgs): void {
  const path = stmt.target.split(".");
  const root = args.env.lookup(path[0] as string);
  if (root === undefined) throw refuse(impure(stmt.target));
  const callee = path.slice(1).reduce<unknown>(reach, root);
  invoke(callee, values(stmt, args));
}

/** A handle answers only to its own verbs; anything else is refused by name. */
function reach(held: unknown, name: string): unknown {
  const surface = handleSurface(held);
  if (surface && !surface.offered.includes(name)) {
    throw missingVerb({ verb: name, kind: surface.kind, offered: surface.offered });
  }
  return memberValue(held, name);
}

function values(stmt: ActionCall, args: DecoBodyArgs): unknown[] {
  const given = callArgs(stmt).map((arg) => evaluate(arg, args.env));
  if (stmt.opts) given.push(evaluate(stmt.opts, args.env));
  return given;
}

function branch(stmt: IfStmt, args: DecoBodyArgs): void {
  if (truthy(evaluate(stmt.cond, args.env))) {
    runStmts(stmt.then.stmts, args);
    return;
  }
  const other = stmt.otherwise;
  if (!other) return;
  // `else if` is another statement; a plain `else` is a block of them.
  if (other.$type === "Block") runStmts((other as Block).stmts, args);
  else dispatch(other as Statement, args);
}

const IMPURE_LET =
  "A decorator runs before the program exists, so this binding cannot call an action.";

const UNSUPPORTED =
  "A decorator body understands `let`, `const`, `if` and verbs on what it was given, this is none of them.";

/**
 * The one sentence for a verb a decorator cannot reach.
 *
 * Exported because the static pass notices the same thing without ever running
 * the body, and two wordings for one fact is how they start to disagree.
 */
export function impure(target: string): string {
  return `A decorator runs before the program exists, so it cannot call \`${target}\`.`;
}

/** Located later, by the statement that asked. */
const NO_SPAN = { uri: "", offset: 0, length: 0, line: 1, column: 1 };

function refuse(title: string): ProblemError {
  return new ProblemError(buildProblem({ spec: CODES.VN2016_DECO_IMPURE, span: NO_SPAN, title }));
}

/** Whatever went wrong, pointed at the line of the body that asked for it. */
function located(error: unknown, stmt: AstNode, uri: string): Problem {
  if (error instanceof ProblemError) return { ...error.problem, span: spanOf(stmt, uri) };
  const title = (error as { message?: string })?.message ?? String(error);
  return buildProblem({ spec: CODES.VN2016_DECO_IMPURE, span: spanOf(stmt, uri), title });
}
