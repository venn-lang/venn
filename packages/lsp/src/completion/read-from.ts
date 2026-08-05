import { type AstNode, isMember, prune, type Type } from "@venn-lang/core";
import { type CstNode, CstUtils, type LangiumDocument } from "langium";

export interface ReadFromArgs {
  /** The node the cursor's dot was found against. */
  host: AstNode;
  /** Where the cursor is: what tells a finished member from one being typed. */
  at: number;
  document: LangiumDocument;
  types: ReadonlyMap<object, Type>;
}

/**
 * The type on the left of a dot: what the members after it belong to.
 *
 * Three shapes sit here that look alike and are not: a member still being
 * typed, a member already written, and a bracket that only groups. Each is read
 * differently, which is why a plain `a.b.c.` is not the whole problem.
 */
export function receiverTypeAt(args: ReadFromArgs): Type | undefined {
  const node = holderOf(args.host, args.at);
  const found = args.types.get(node) ?? groupType(args);
  return found && withoutNothing(prune(found));
}

/**
 * What the value may be, with absence set aside.
 *
 * A read by position answers `T | null`, and the checker refuses reading through
 * one without a guard. The editor still has to say what `T` holds: offering
 * nothing teaches nothing, and the reader is about to write the guard the
 * diagnostic asks them for. Absence carries no members of its own, so setting it
 * aside cannot invent one.
 */
export function withoutNothing(type: Type): Type {
  if (type.kind !== "union") return type;
  const there = type.members.filter((one) => !(one.kind === "prim" && one.name === "null"));
  return there.length === 1 ? (there[0] as Type) : type;
}

/**
 * A member already written, told apart from one still being typed.
 *
 * `xs[0].ma▮` is half a member with no type of its own, so its receiver
 * answers. `xs[0].entries.▮` is finished and its type is the list it gives
 * back, so past the member's last character it answers for itself.
 */
function holderOf(host: AstNode, at: number): AstNode {
  if (!isMember(host)) return host;
  const end = host.$cstNode?.end;
  return end !== undefined && end < at ? host : host.receiver;
}

/**
 * What a grouping `(…)` holds: `(1 + 2).▮` is a number.
 *
 * Brackets that only group carry no node of their own, so the `)` belongs to
 * the enclosing statement and the cursor lands on something untyped. A call or
 * an index does have a node ending at its bracket, so this runs only when the
 * direct reading comes up empty.
 */
function groupType(args: ReadFromArgs): Type | undefined {
  const root = args.document.parseResult?.value?.$cstNode;
  if (!root) return undefined;
  const closing = before(root, args.at - 1);
  if (closing?.text !== ")") return undefined;
  const last = before(root, closing.offset - 1)?.astNode;
  return last && outermostTyped({ from: last, end: closing.offset, types: args.types });
}

function before(root: CstNode, at: number): CstNode | undefined {
  return CstUtils.findLeafNodeAtOffset(root, at) ?? CstUtils.findLeafNodeBeforeOffset(root, at);
}

/**
 * The largest expression that still ends inside the brackets: `("a" + "b").`
 * is the whole sum, not its last word. Only a node the checker gave a type to
 * counts: the tree also holds an argument list and a call ending in the same
 * place, and neither is a value anyone can read a member from.
 */
function outermostTyped(args: {
  from: AstNode;
  end: number;
  types: ReadonlyMap<object, Type>;
}): Type | undefined {
  let found: Type | undefined;
  for (let node: AstNode | undefined = args.from; node; node = node.$container) {
    if ((node.$cstNode?.end ?? args.end + 1) > args.end) break;
    found = args.types.get(node) ?? found;
  }
  return found;
}
