import {
  type Annotation,
  type AstNode,
  buildProblem,
  CODES,
  isAnnotation,
  type Problem,
  wrongPlace,
} from "@venn-lang/core";
import { nodeSpan } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";

/**
 * A decorator written somewhere it does not belong.
 *
 * Expansion refuses this, and expansion only runs when the program does, so
 * `@timeout` on a `parallel` cost both of its steps their full duration before
 * anything said the decorator was in the wrong place. Where a decorator may sit
 * is a fact about the text: the definition lists the node types it is handed,
 * and the node under it has a type. Nothing has to run to compare two lists.
 *
 * The sentence and the code come from {@link wrongPlace}, which expansion asks
 * too, so the same mistake reads the same whichever of the two found it.
 *
 * A `deco` this file declares is left alone here. Its signature is what says
 * what it decorates, and the type checker already refuses a misplaced one from
 * that signature, in the words the author wrote rather than in node types.
 *
 * @param node Any node of the parsed document; only a decorated one is read.
 * @param ctx The document's context, for the loaded decorators and the uri.
 * @returns One problem per annotation in the wrong place, or none.
 * @throws Nothing.
 */
export function checkDecoratorTarget(node: AstNode, ctx: CheckContext): Problem[] {
  if (!ctx.decorators) return [];
  return annotationsOf(node).flatMap((one) => misplaced(one, node, ctx));
}

/** The annotations a node carries, which only some kinds of node can. */
function annotationsOf(node: AstNode): readonly Annotation[] {
  if (!("annotations" in node)) return [];
  const written = node.annotations;
  return Array.isArray(written) ? written.filter(isAnnotation) : [];
}

function misplaced(annotation: Annotation, node: AstNode, ctx: CheckContext): Problem[] {
  const name = annotation.name;
  if (ctx.decos.has(name)) return [];
  const found = ctx.decorators?.get(name);
  const title = found && wrongPlace({ found, node, name });
  if (!title) return [];
  const spec = CODES.VN2014_DECORATOR_TARGET;
  return [buildProblem({ spec, span: nodeSpan(annotation, ctx.uri), title })];
}
