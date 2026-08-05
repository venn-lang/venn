/**
 * The receiver of a member read, as the source spelled it.
 *
 * Two diagnostics quote it back and they must quote it the same way: the pair
 * read by name, whose way out is `e[0]` beside the reader's own `e`, and the read
 * through a value that may be nothing, which names `xs[5]` rather than the type
 * `string | null` that no line of the file contains.
 */

import * as ast from "../generated/ast.js";
import type { MemberRead } from "./member-read.types.js";

/** How long an expression may be written before quoting it back stops helping. */
const TOO_LONG = 40;

const RUNS_OF_SPACE = /\s+/g;

/**
 * The receiver as written, when it is short enough to be worth quoting.
 *
 * A name, a short index or a call is a line the reader can find again by eye.
 * Anything longer, and anything parsed out of a `${…}` and so carrying no source
 * of its own, is left to the wording that names no name: a paragraph of
 * somebody's expression read back at them helps nobody find the character that
 * is wrong.
 *
 * Whitespace inside is collapsed rather than refused. `strongest(answer.found,
 * "hp")` has a space in it and is exactly the kind worth naming: without it the
 * sentence read "This value may be nothing here" in a file with four other
 * candidates on the same page.
 *
 * @param read The member read, which knows the node the source wrote.
 * @returns The text, or nothing when there is none worth printing.
 */
export function receiverAsWritten(read: MemberRead): string | undefined {
  const node = read.node;
  if (!ast.isMember(node) && !ast.isIndex(node)) return undefined;
  const text = node.receiver.$cstNode?.text?.trim().replace(RUNS_OF_SPACE, " ");
  return text && text.length <= TOO_LONG ? text : undefined;
}
