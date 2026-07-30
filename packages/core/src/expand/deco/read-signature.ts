import type { DecoDecl, TypeRef } from "../../generated/ast.js";
import { acceptedKinds, decoTarget } from "../accepted-kinds.js";
import type { TargetKind } from "../handles/index.js";
import { everyKindWritten } from "../wrong-kind.js";
import type { SignatureResult } from "./deco.types.js";

/**
 * Read a `deco`'s parameters as what they mean.
 *
 * The first parameter *is* the target and its type is what may carry the
 * decorator; the rest are the decorator's own arguments, filled by `@name(…)` in
 * order. Nobody writing a decorator ever names a node of the compiler's tree,
 * and what it decorates follows from the signature rather than from a list kept
 * beside it.
 *
 * @returns the signature, or the one-line reason it does not read.
 */
export function readSignature(decl: DecoDecl): SignatureResult {
  const target = decoTarget(decl);
  // A pattern here has nothing to take apart: the target is a handle, and the
  // arguments after it are filled in order by `@name(…)`.
  if (!target?.name) return { ok: false, title: needsTarget(decl.name) };
  if (!target.paramType) return { ok: false, title: needsType(decl.name, target.name) };
  const kinds = acceptedKinds(decl);
  // A union may name several kinds; one word that is not a kind spoils it all.
  if (kinds.length !== target.paramType.members.length) {
    return { ok: false, title: notAKind(decl.name, target.paramType) };
  }
  const args = (decl.params?.params ?? []).slice(1);
  if (args.some((one) => !one.name)) return { ok: false, title: needsNames(decl.name) };
  return signature({ target: target.name, kinds, args: args.map((one) => one.name as string) });
}

function signature(args: {
  target: string;
  kinds: readonly TargetKind[];
  args: readonly string[];
}): SignatureResult {
  return { ok: true, signature: { target: args.target, kinds: args.kinds, args: args.args } };
}

function written(type: TypeRef): string {
  return type.members.map((member) => (member as { name?: string }).name ?? "?").join(" | ");
}

function needsTarget(name: string): string {
  return `\`deco ${name}\` needs a first parameter, named: the thing it decorates.`;
}

function needsNames(name: string): string {
  return `\`deco ${name}\` names its arguments one by one, since \`@${name}(…)\` fills them in order.`;
}

function needsType(name: string, target: string): string {
  const kinds = everyKindWritten();
  return `\`deco ${name}\` must say what it decorates: give \`${target}\` a type, one of ${kinds}.`;
}

function notAKind(name: string, type: TypeRef): string {
  const kinds = everyKindWritten();
  return `\`deco ${name}\` decorates \`${written(type)}\`, which is not a kind: say ${kinds}.`;
}
