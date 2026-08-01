import { type AstNode, CODES, isAnnotation, isRef, type Problem, type Ref } from "@venn-lang/core";
import { isPrelude } from "@venn-lang/prelude";
import type { CheckContext } from "./check.types.js";
import { problemAt } from "./problem-at.js";

/**
 * A name nothing binds.
 *
 * Reading one is not an error the runtime can report usefully: it answers
 * `null`, and a program carries that until something else fails over it, three
 * lines and one file away. So it is said here, where the name is written.
 *
 * The three keywords that stand where a value does (`matrix`, `flow`, `step`)
 * are references to the run rather than to a binding, and are always in scope.
 */
const OF_THE_RUN = new Set(["matrix", "flow", "step", "env"]);

export function checkUnbound(node: AstNode, ctx: CheckContext): Problem[] {
  if (!isRef(node) || insideAnnotation(node) || known(node.name, ctx)) return [];
  const title = `Nothing is named "${node.name}" here.`;
  return [{ ...problemAt(node, ctx, CODES.VN2018_UNBOUND_NAME, title), help: help(node, ctx) }];
}

/**
 * A bare name inside a decorator is a word, not a reference.
 *
 * `@tags(smoke)` names a tag and `@scope(worker)` names a lifetime. Decorators
 * run before the program exists, so there is nothing yet for one to refer to,
 * and the expander reads a `Ref` there as its own text rather than looking it
 * up.
 */
function insideAnnotation(node: AstNode): boolean {
  for (let at = node.$container; at; at = at.$container) if (isAnnotation(at)) return true;
  return false;
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
  const near = nearest(node.name, ctx.declared);
  if (near) return `Did you mean \`${near}\`?`;
  return "Bind it with `const` or `let`, or bring it in with `import`.";
}

function nearest(name: string, names: ReadonlySet<string>): string | undefined {
  let best: string | undefined;
  let closest = Math.min(3, Math.floor(name.length / 2) + 1);
  for (const candidate of names) {
    const gap = distance(name, candidate);
    if (gap < closest) [best, closest] = [candidate, gap];
  }
  return best;
}

/**
 * Levenshtein distance, over two names.
 *
 * One row rather than a matrix: names are short, this runs once per unbound
 * reference, and the whole point is that unbound references are rare.
 */
function distance(left: string, right: string): number {
  let row = Array.from({ length: right.length + 1 }, (_, at) => at);
  for (let down = 1; down <= left.length; down += 1) {
    const next = [down];
    for (let across = 1; across <= right.length; across += 1) {
      const same = left[down - 1] === right[across - 1];
      next[across] = Math.min(
        (next[across - 1] as number) + 1,
        (row[across] as number) + 1,
        (row[across - 1] as number) + (same ? 0 : 1),
      );
    }
    row = next;
  }
  return row[right.length] as number;
}
