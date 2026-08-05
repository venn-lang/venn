/**
 * Whether a decision written as a chain of `if`s covers the union it is deciding
 * on. A case nobody wrote falls through to nothing, silently, and a union exists
 * precisely to say those are all the cases there are.
 */

import { CODES } from "../codes/index.js";
import type { Block, IfStmt } from "../generated/ast.js";
import * as ast from "../generated/ast.js";
import type { Infer } from "./infer.js";
import { type Discriminant, discriminantOf, listed, type Tag, tagOf } from "./narrow.js";
import { instantiate } from "./scheme.js";
import type { Type } from "./type.types.js";
import type { TypeEnv } from "./type-env.js";
import { prune } from "./unify.js";

/** A chain, read as the case analysis it is: what it tests and what it covers. */
interface Chain {
  found: Discriminant[];
  /** Absent when the chain ends without one, which is what makes a gap a gap. */
  fallback: Block | undefined;
}

/**
 * Report the cases a chain of `if`s leaves out.
 *
 * Silent unless the chain plainly enumerates: two branches or more, every one of
 * them testing the same field of the same name, and no `else` to catch the rest.
 * One `if` on its own asks a question rather than listing the answers.
 *
 * @param head The first `if` of the chain.
 * @param env The scope it stands in, where the name still holds the whole union.
 * @param infer Where the missing cases are reported.
 */
export function checkCases(head: IfStmt, env: TypeEnv, infer: Infer): void {
  const chain = chainOf(head);
  if (chain.fallback || chain.found.length < 2) return;
  const first = chain.found[0] as Discriminant;
  if (!sameSubject(chain.found, first)) return;
  const missing = uncovered(subjectType(first.name, env, infer), chain.found, first.field);
  if (missing.length > 0) report(head, first, missing, infer);
}

function chainOf(head: IfStmt): Chain {
  const found: Discriminant[] = [];
  let node = head;
  for (;;) {
    const one = discriminantOf(node.cond);
    if (!one?.equals) return { found: [], fallback: undefined };
    found.push(one);
    if (!node.otherwise) return { found, fallback: undefined };
    if (!ast.isIfStmt(node.otherwise)) return { found, fallback: node.otherwise };
    node = node.otherwise;
  }
}

/** Every branch asking about the same thing is what makes the chain one decision. */
function sameSubject(found: readonly Discriminant[], first: Discriminant): boolean {
  return found.every((one) => one.name === first.name && one.field === first.field);
}

function subjectType(name: string, env: TypeEnv, infer: Infer): Type | undefined {
  const scheme = env.lookup(name);
  return scheme && prune(instantiate(scheme, infer.ctx));
}

/**
 * The tags no branch asked about. Empty when the subject is not a union of
 * branches told apart by a value, since then there is no list of cases to be
 * missing from.
 */
function uncovered(
  type: Type | undefined,
  found: readonly Discriminant[],
  field: string | undefined,
): Tag[] {
  if (type?.kind !== "union") return [];
  const tags = type.members.map((member) => tagOf(member, field));
  if (tags.some((tag) => tag === undefined)) return [];
  const asked = new Set(found.map((one) => one.value));
  return (tags as Tag[]).filter((tag) => !asked.has(tag));
}

function report(head: IfStmt, first: Discriminant, missing: readonly Tag[], infer: Infer): void {
  const subject = first.field ? `${first.name}.${first.field}` : first.name;
  infer.ctx.mismatches.push({
    node: head.cond,
    expected: { kind: "dynamic" },
    actual: { kind: "dynamic" },
    code: CODES.VN3019_MISSING_CASE,
    sentence: `Nothing here says what to do when ${subject} is ${listed(missing)}.`,
  });
}
