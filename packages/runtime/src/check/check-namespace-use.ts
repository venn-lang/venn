import {
  type AstNode,
  type Document,
  isActionCall,
  isMember,
  isRef,
  type Problem,
  walkAst,
} from "@venn-lang/core";
import { nodeSpan } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";
import { enclosingDeco } from "./check-deco-body.js";
import { namesANamespace } from "./names-a-namespace.js";
import { notImportedHere } from "./not-imported-here.js";

/**
 * A namespace this file uses and never imported, said once for the whole file.
 *
 * Asked of the document rather than of each node, because the missing import is
 * a fact about the top of the file and not about the twentieth `io.print`.
 * Every position counts, read and call alike: the point of this pass is that
 * one expression stops getting three different answers depending on where it
 * was written.
 *
 * A slot inside a string is parsed apart from this tree and never reached here.
 * `env` is the namespace that lives in slots, and `envProblemsIn` says the same
 * sentence for one.
 *
 * @param document The file being checked.
 * @param ctx The document's resolved context.
 * @returns One hint per namespace, placed on the first use of it.
 */
export function checkNamespaceUse(document: Document, ctx: CheckContext): Problem[] {
  const said = new Set<string>();
  const problems: Problem[] = [];
  for (const node of walkAst(document)) {
    const head = headOf(node, ctx);
    if (head === undefined || said.has(head)) continue;
    said.add(head);
    const pkg = ctx.registry.packageOf(head);
    if (pkg) problems.push(notImportedHere({ name: head, pkg, span: nodeSpan(node, ctx.uri) }));
  }
  return problems;
}

/** The name in front of the dot, when it stands for a namespace nothing brought in. */
function headOf(node: AstNode, ctx: CheckContext): string | undefined {
  const head = writtenHead(node);
  if (head === undefined || ctx.imported.has(head)) return undefined;
  // A `deco` body is resolved by expansion rather than against the registry, so
  // whether the file imported the name is not what is wrong with it.
  if (enclosingDeco(node)) return undefined;
  return namesANamespace(head, ctx) ? head : undefined;
}

/**
 * Where a namespace is written, in the two shapes it has. A statement call
 * carries its whole dotted target as text, and an expression holds a receiver.
 */
function writtenHead(node: AstNode): string | undefined {
  if (isActionCall(node)) {
    const dot = node.target.indexOf(".");
    return dot < 0 ? undefined : node.target.slice(0, dot);
  }
  return isMember(node) && isRef(node.receiver) ? node.receiver.name : undefined;
}
