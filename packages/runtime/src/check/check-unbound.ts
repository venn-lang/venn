import {
  type AstNode,
  CODES,
  insideAnnotation,
  isRef,
  type Problem,
  type Ref,
} from "@venn-lang/core";
import { isPrelude } from "@venn-lang/prelude";
import { nearestName } from "../suggest/index.js";
import type { CheckContext } from "./check.types.js";
import { paramsADecoratorAdds } from "./decorator-params.js";
import { problemAt } from "./problem-at.js";

/**
 * The keywords that stand where a value does.
 *
 * `matrix`, `flow` and `step` are references to the run rather than to a
 * binding, and `env` to what the host was started with, so all four are in
 * scope everywhere without anything having bound them.
 */
const OF_THE_RUN = new Set(["matrix", "flow", "step", "env"]);

/**
 * A name nothing binds.
 *
 * Reading one is not an error the runtime can report usefully: it answers
 * `null`, and a program carries that until something else fails over it, three
 * lines and one file away. So it is said here, where the name is written.
 *
 * @param node Any node of the document; only a reference is answered about.
 * @param ctx What the file binds, imports and declares.
 * @returns One VN2018 for a name nothing in reach binds, else nothing.
 */
export function checkUnbound(node: AstNode, ctx: CheckContext): Problem[] {
  if (!isRef(node) || insideAnnotation(node) || known(node.name, ctx)) return [];
  const added = paramsADecoratorAdds(node, ctx);
  if (added.unreadable || added.names.has(node.name)) return [];
  const title = `Nothing is named "${node.name}" here.`;
  return [
    { ...problemAt({ node, ctx, spec: CODES.VN2018_UNBOUND_NAME, title }), help: help(node, ctx) },
  ];
}

function known(name: string, ctx: CheckContext): boolean {
  return (
    OF_THE_RUN.has(name) ||
    isPrelude(name) ||
    ctx.declared.has(name) ||
    ctx.aliases.has(name) ||
    ctx.imported.has(name) ||
    ctx.fragments.has(name) ||
    // A namespace the registry knows but this file did not import is somebody
    // else's diagnostic: VN2007 says to import it, which is the useful thing to
    // hear. Saying the name does not exist would be the wrong sentence.
    ctx.registry.hasNamespace(name)
  );
}

/**
 * The nearest name in scope, when there is one close enough to be the one meant.
 *
 * A typo is the usual cause, so the fix is usually a name that is already there.
 * Where nothing is close, the help says how a name comes to exist instead, which
 * is the other reason this fires.
 */
function help(node: Ref, ctx: CheckContext): string {
  const near = nearestName(node.name, ctx.declared);
  if (near) return `Did you mean \`${near}\`?`;
  return "Bind it with `const` or `let`, or bring it in with `import`.";
}
