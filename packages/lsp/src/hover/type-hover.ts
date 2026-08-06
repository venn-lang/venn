import { type AstNode, isExpr, prune, showType, showTypes, type Type } from "@venn-lang/core";
import { AstUtils, type CstNode } from "langium";
import type { TypeService } from "../types/index.js";

/** The inferred type of a node: `list<number>`, `fn(number) -> number`. */
export function typeLabel(node: AstNode | undefined, types: TypeService): string | undefined {
  if (!node) return undefined;
  const found = types.of(AstUtils.getDocument(node)).types.get(node);
  return found ? spread(found) : undefined;
}

/**
 * A `fn`'s signature, spelled the way the language spells it.
 *
 * The card used to put the parameter names on the left and the whole function
 * type on the right, joined by a colon: `fn scoreOn(entry, stat): fn(Entry,
 * string) -> number`. It said the parameter list twice, and a colon in front of
 * a `fn(…)` reads as a return, so a function taking two arguments looked like
 * one handing a function back.
 *
 * Names come from the declaration and types from the checker, paired by
 * position and rendered together, so a variable in two places gets one letter
 * in both.
 *
 * @returns The signature, or nothing when the checker has no `fn` type for the
 * node, which is the moment before a build finishes rather than an error.
 */
export function signatureLabel(args: {
  node: AstNode;
  names: readonly string[];
  types: TypeService;
}): string | undefined {
  const found = args.types.of(AstUtils.getDocument(args.node)).types.get(args.node);
  const fn = found && prune(found);
  if (!fn || fn.kind !== "fn") return undefined;
  const shown = showTypes([...fn.params, fn.result]);
  const taken = args.names.map((name, at) => told(name, shown[at]));
  return `(${taken.join(", ")}) -> ${shown[fn.params.length]}`;
}

/** `entry: Entry`, or the bare name where the checker knows nothing about it. */
function told(name: string, type: string | undefined): string {
  return type === undefined || type === "dynamic" ? name : `${name}: ${type}`;
}

/** Past this many fields a shape stops reading as a line and starts reading as a wall. */
const INLINE_FIELDS = 3;

/**
 * The same type, one field per line once there are enough of them to matter.
 *
 * A diagnostic wants a type on one line, which is what `showType` gives. A
 * hover has room, and a decorator handle carrying ten verbs on one line is
 * exactly as much use as no hover at all.
 */
function spread(type: Type): string {
  const pruned = prune(type);
  if (pruned.kind !== "record" || pruned.fields.size <= INLINE_FIELDS) return showType(pruned);
  const fields = [...pruned.fields].map(([name, field]) => `  ${name}: ${showType(field)},`);
  return `{\n${fields.join("\n")}\n}`;
}

/**
 * The type of the expression a token belongs to, as a hover. Used when nothing
 * else describes the token, so hovering `.len` or a literal still answers.
 */
export function inferredType(leaf: CstNode, types: TypeService): string | undefined {
  if (!carriesMeaning(leaf.text)) return undefined;
  const known = types.of(AstUtils.getDocument(leaf.astNode)).types;
  const type = nearestType(leaf, known);
  return type ? `\`\`\`venn\n${showType(type)}\n\`\`\`` : undefined;
}

const NAME_OR_LITERAL = /^([A-Za-z_]\w*|\d|["'])/;

/**
 * Only a name or a literal describes a value. A bracket or a comma belongs to
 * the expression around it, so answering for one would make hovering `(`
 * report the type of whatever it encloses.
 */
function carriesMeaning(text: string): boolean {
  return NAME_OR_LITERAL.test(text);
}

/** Walk from the token's node outward to the nearest expression that has a type. */
function nearestType(leaf: CstNode, types: ReadonlyMap<AstNode, Type>): Type | undefined {
  let node: AstNode | undefined = leaf.astNode;
  while (node) {
    if (isExpr(node)) {
      const type = types.get(node);
      if (type) return type;
    }
    node = node.$container;
  }
  return undefined;
}
