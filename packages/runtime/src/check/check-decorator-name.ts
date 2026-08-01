import {
  type Annotation,
  type AstNode,
  buildProblem,
  CODES,
  isDecoDecl,
  type Problem,
} from "@venn-lang/core";
import { nodeSpan } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";
import { nearestName } from "./nearest-name.js";

/**
 * A decorator nothing provides.
 *
 * Expansion reports this, and expansion only runs when the program does, so
 * `venn check` called a file clean that `venn test` refused. It needs no body
 * executed: whether a name resolves is a lookup, and running one to find out
 * would mean the editor executing plugin code on every keystroke.
 *
 * Where a decorator resolves, what it does with its target is left alone here.
 */
export function checkDecoratorName(node: AstNode, ctx: CheckContext): Problem[] {
  if (!ctx.decorators) return [];
  const written = (node as { annotations?: Annotation[] }).annotations ?? [];
  return written.filter((one) => !known(one.name, ctx)).map((one) => refuse(one, ctx));
}

function known(name: string, ctx: CheckContext): boolean {
  return Boolean(ctx.decorators?.get(name)) || ctx.decos.has(name);
}

function refuse(annotation: Annotation, ctx: CheckContext): Problem {
  const near = nearestName(annotation.name, everyName(ctx));
  const found = buildProblem({
    spec: CODES.VN2013_UNKNOWN_DECORATOR,
    span: nodeSpan(annotation, ctx.uri),
    title: `No decorator is named "@${annotation.name}".`,
  });
  return near ? { ...found, help: `Did you mean \`@${near}\`?` } : found;
}

/** Every decorator in reach: the ones loaded, and the ones this file declares. */
function everyName(ctx: CheckContext): string[] {
  return [...(ctx.decorators?.names() ?? []), ...ctx.decos];
}

/**
 * Every `deco` in reach by name: the ones this file declares, and the ones it
 * imported, since a `pub deco` travels the way a `pub fn` does.
 */
export function decosOf(
  document: { decls: readonly AstNode[] },
  imported: Iterable<string> = [],
): Set<string> {
  const own = document.decls.filter(isDecoDecl).map((decl) => decl.name);
  return new Set([...own, ...imported]);
}
