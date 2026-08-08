import type { TypeRef } from "../../generated/ast.js";

/**
 * A written annotation, read back as the text that was written.
 *
 * The checker's `showType` answers about an inferred `Type`, which only exists
 * once a document has been checked. A decorator runs before that, at expansion,
 * so the only type there is to read is the one the reader wrote, and this reads
 * it off the annotation's own tree.
 *
 * The source's own text, so a generic like `list<number>` survives the trip and
 * a literal keeps the quotes the grammar gave it. A member with no source is a
 * member nothing wrote: `addParam` is the only verb that grows a parameter list
 * and it adds a name without a type, so the empty answer is the true one rather
 * than a gap to fill in.
 *
 * @param ref The annotation, or nothing where none was written.
 * @returns The type as written, a union joined by ` | ` in the order its
 * alternatives were written, and `""` when there is no annotation at all.
 */
export function typeRefText(ref: TypeRef | undefined): string {
  return (ref?.members ?? []).map((member) => member.$cstNode?.text.trim() ?? "").join(" | ");
}
