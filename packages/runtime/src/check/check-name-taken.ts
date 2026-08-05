import {
  type AstNode,
  boundNames,
  buildProblem,
  CODES,
  type Document,
  handedOn,
  isDecoDecl,
  isFnDecl,
  isFragmentDecl,
  isLetStmt,
  isTypeDecl,
  isValueImport,
  type Problem,
} from "@venn-lang/core";
import { nodeSpan } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";

/**
 * One name, bound twice in one file.
 *
 * The second one wins, quietly, and what it takes over may be a namespace:
 *
 * ```venn
 * import { json } from "venn/json"
 * const json = { parse: (x) => "mine" }
 * print json.parse("{}")            // "mine"
 * ```
 *
 * Removing `use` was about a file saying what it takes, so that a reader finds
 * out where a name came from by reading the top. A name that means one thing at
 * the top and another thirty lines down takes that back.
 *
 * Reported once, at the second one, with the first shown beside it: which is
 * which is the whole of what a reader needs, and `as` is the fix either way.
 */
export function checkNameTaken(document: Document, ctx: CheckContext): Problem[] {
  const taken = new Map<string, AstNode>();
  const problems: Problem[] = [];
  for (const decl of document.imports) {
    if (isValueImport(decl)) claim({ names: handedOn(decl), at: decl, taken, problems, ctx });
  }
  for (const decl of document.decls) {
    claim({ names: declared(decl), at: decl, taken, problems, ctx });
  }
  return problems;
}

interface Claim {
  names: readonly string[];
  at: AstNode;
  taken: Map<string, AstNode>;
  problems: Problem[];
  ctx: CheckContext;
}

function claim(args: Claim): void {
  for (const name of args.names) {
    const first = args.taken.get(name);
    if (first) args.problems.push(refuse({ name, first, second: args.at, ctx: args.ctx }));
    else args.taken.set(name, args.at);
  }
}

function refuse(args: {
  name: string;
  first: AstNode;
  second: AstNode;
  ctx: CheckContext;
}): Problem {
  return buildProblem({
    spec: CODES.VN2020_NAME_TAKEN,
    span: nodeSpan(args.second, args.ctx.uri),
    title: `"${args.name}" is already the name of something in this file.`,
    help: `Rename one of them, or bring the first in under another name with \`as\`.`,
    related: [
      { span: nodeSpan(args.first, args.ctx.uri), label: `\`${args.name}\` is bound here` },
    ],
  });
}

/**
 * What a top-level declaration binds.
 *
 * Only the top level. A name bound inside a step or a function is a local, and
 * a local shadowing an outer name is what locals are for; what this is about is
 * two things claiming the file.
 */
function declared(decl: AstNode): readonly string[] {
  if (isLetStmt(decl)) return boundNames(decl);
  if (isFnDecl(decl) || isFragmentDecl(decl) || isDecoDecl(decl) || isTypeDecl(decl)) {
    return [decl.name];
  }
  return [];
}
