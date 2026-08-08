import {
  isLiteralType,
  isNamedType,
  isNullType,
  type SingleType,
  type TypeRef,
} from "../../generated/ast.js";

/**
 * A written annotation, read back as the text that was written.
 *
 * The checker's `showType` answers about an inferred `Type`, which only exists
 * once a document has been checked. A decorator runs before that, at expansion,
 * so the only type there is to read is the one the reader wrote, and this reads
 * it off the annotation's own tree.
 *
 * @param ref The annotation, or nothing where none was written.
 * @returns The type as written: a union joined by ` | ` in the order its
 * alternatives were written, a literal with the quotes the grammar gave it, and
 * `""` when there is no annotation at all.
 */
export function typeRefText(ref: TypeRef | undefined): string {
  // The source's own text, so a generic like `list<number>` survives the trip.
  return (ref?.members ?? [])
    .map((member) => member.$cstNode?.text.trim() ?? synthesized(member))
    .join(" | ");
}

/** A member a decorator built has no source to quote, so it is written out. */
function synthesized(member: SingleType): string {
  if (isNullType(member)) return "null";
  // `value` is the token the grammar matched, quotes included.
  if (isLiteralType(member)) return member.value;
  if (!isNamedType(member)) return "";
  const args = member.args.map(typeRefText).join(", ");
  return args ? `${member.name}<${args}>` : member.name;
}
