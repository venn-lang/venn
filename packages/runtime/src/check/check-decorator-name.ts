import {
  type Annotation,
  type AstNode,
  buildProblem,
  CODES,
  type DecoDecl,
  isDecoDecl,
  type Problem,
} from "@venn-lang/core";
import { nodeSpan } from "../scheduler/index.js";
import { nearestName } from "../suggest/index.js";
import type { CheckContext } from "./check.types.js";

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
  return new Set([...decoDeclsOf(document).keys(), ...imported]);
}

/**
 * The `deco`s this file declares, by name, for a check that has to read one.
 *
 * @param document The parsed file.
 * @returns Each declaration by the name it was given; the last of a repeated
 * name wins, which is the one expansion resolves to as well.
 */
export function decoDeclsOf(document: { decls: readonly AstNode[] }): Map<string, DecoDecl> {
  return new Map(document.decls.filter(isDecoDecl).map((decl) => [decl.name, decl]));
}
