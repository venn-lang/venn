import type { AstNode } from "langium";
import type { Document } from "../generated/ast.js";

/**
 * The file each parsed tree came from, keyed weakly by its root so a document
 * that goes out of scope takes its entry with it.
 */
const files = new WeakMap<AstNode, string>();

/**
 * Remember the file a freshly parsed tree came from.
 *
 * Called by `parse` and nowhere else: the parser is the only thing handed both
 * the text and the name of the file it came out of.
 *
 * @param document The tree just parsed.
 * @param uri The file it was parsed from.
 */
export function recordFile(document: Document, uri: string): void {
  files.set(document, uri);
}

/**
 * The file a node was parsed from.
 *
 * `spanOf` answers where in a file a node sits and takes the file as an
 * argument, because whoever asks usually has one to hand. The compiler does
 * not: a `fn` body is compiled once, away from the document that asked for it,
 * and every refusal it built used to carry an empty uri, which the reporter
 * prints as no location at all. So the same `forEach` refusal named the file
 * and line at the top of a program and named nothing inside a `fn`.
 *
 * @param node Any node of a tree `parse` produced.
 * @returns Its file, or an empty string for a tree that came from anywhere
 * else: an expression parsed on its own, or a document an editor built.
 */
export function fileOf(node: AstNode): string {
  let at: AstNode = node;
  while (at.$container) at = at.$container;
  return files.get(at) ?? "";
}
