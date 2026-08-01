import {
  type AssignStmt,
  boundNames,
  buildProblem,
  CODES,
  type Document,
  isAssignStmt,
  isLetStmt,
  isRef,
  type Problem,
  walkAst,
} from "@venn-lang/core";
import { nodeSpan } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";

/**
 * Writing to a name that was declared `const`.
 *
 * Until assignment existed, `let` and `const` differed in nothing, which is why
 * both are in the language and neither was worth choosing between. `const` is
 * the one that says the name holds one value for good, and the whole of what
 * that promise is worth is this refusal.
 *
 * A member of a `const` is another matter: `const m = { … }` says `m` names one
 * map, not that the map never changes. Rebinding the name is refused; writing
 * into what it names is not.
 */
export function checkAssign(document: Document, ctx: CheckContext): Problem[] {
  const fixed = constants(document);
  const problems: Problem[] = [];
  for (const node of walkAst(document)) {
    if (isAssignStmt(node)) problems.push(...rebinding(node, fixed, ctx));
  }
  return problems;
}

function rebinding(stmt: AssignStmt, fixed: ReadonlySet<string>, ctx: CheckContext): Problem[] {
  const target = stmt.target;
  if (!isRef(target) || !fixed.has(target.name)) return [];
  return [
    {
      ...buildProblem({
        spec: CODES.VN2022_CONST_ASSIGNED,
        span: nodeSpan(stmt, ctx.uri),
        title: `"${target.name}" was declared with \`const\`, so it keeps what it was given.`,
      }),
      help: "Declare it with `let` if it is meant to change.",
    },
  ];
}

/**
 * Every name this file fixed with `const`, and none it also bound with `let`.
 *
 * Blunt about scope, like every other check here: a name that is `const`
 * somewhere and `let` somewhere else is two bindings, and refusing the write
 * would be refusing the wrong one. The cost is a miss, never a false report.
 */
function constants(document: Document): Set<string> {
  const fixed = new Set<string>();
  const changeable = new Set<string>();
  for (const node of walkAst(document)) {
    if (!isLetStmt(node)) continue;
    for (const name of boundNames(node)) (node.kind === "const" ? fixed : changeable).add(name);
  }
  for (const name of changeable) fixed.delete(name);
  return fixed;
}
