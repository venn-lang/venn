/**
 * Which of the grammar's constructs the corpus writes, and which it does not.
 *
 * The corpus reaches exactly as far as the bodies somebody thought to write, so
 * the list of what is missing has to come from the grammar rather than from a
 * person. It does: the AST reflection Langium generates knows every alternative
 * of `Statement`, `Declaration` and `Expr`, and a rule added to the grammar
 * appears here with no edit anywhere.
 *
 * A case exercises a construct when a node of that kind sits inside the case's
 * own body. Inside matters: the four wrappers write `run`, `fragment`, `fn`, a
 * `let`, a `return` and a call of their own, so a survey that took the whole
 * generated file would certify fourteen constructs no case ever wrote. Text
 * matching cannot do this either, because `#` opens a comment and every keyword
 * is a legal member name, so `res.try` and a header reading "no try case yet"
 * would both count as a `try`.
 */

import { type AstNode, parse, reflection, walkAst } from "@venn-lang/core";
import { PLACEMENTS, placed } from "./placements.js";
import type { Case, Placement } from "./same-everywhere.types.js";

const URI = "memory://constructs.vn";

/** The three unions every construct of the language is an alternative of. */
const ROOTS = ["Statement", "Declaration", "Expr"];

/**
 * Every construct the grammar has, by AST type name, in name order.
 *
 * @returns The concrete alternatives, the abstract unions left out.
 */
export function everyConstruct(): string[] {
  const named = new Set(ROOTS.flatMap((root) => reflection.getAllSubTypes(root)));
  return [...named].filter(isConcrete).sort();
}

/** A union answers with its alternatives; a construct answers with itself alone. */
function isConcrete(name: string): boolean {
  return reflection.getAllSubTypes(name).length === 1;
}

/**
 * The constructs these cases write, in any placement each of them is legal in.
 *
 * @param cases Every case on disk, as the driver reads them.
 * @returns The type names found inside the bodies, and nothing from a wrapper.
 */
export function exercisedBy(cases: readonly Case[]): Set<string> {
  const found = new Set<string>();
  for (const one of cases) {
    for (const placement of PLACEMENTS) {
      if (one.excludes.has(placement)) continue;
      for (const name of insideTheBody(placement, one.body)) found.add(name);
    }
  }
  return found;
}

function insideTheBody(placement: Placement, body: string): string[] {
  const { source, from, to } = placed(placement, body);
  const parsed = parse(`${source}\n`, { uri: URI });
  return walkAst(parsed.ast)
    .filter((node) => within(node, from, to))
    .map((node) => node.$type);
}

function within(node: AstNode, from: number, to: number): boolean {
  const cst = node.$cstNode;
  return cst !== undefined && cst.offset >= from && cst.end <= to;
}
