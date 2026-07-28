import type { DecoDecl, Param, TypeRef } from "../../generated/ast.js";
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
  if (!target) return { ok: false, title: needsTarget(decl.name) };
  if (!target.paramType) return { ok: false, title: needsType(decl.name, target.name) };
  const kinds = acceptedKinds(decl);
  // A union may name several kinds; one word that is not a kind spoils it all.
  if (kinds.length !== target.paramType.members.length) {
    return { ok: false, title: notAKind(decl.name, target.paramType) };
  }
  return signature(target, kinds, decl.params?.params ?? []);
}

function signature(
  target: Param,
  kinds: readonly TargetKind[],
  params: readonly Param[],
): SignatureResult {
  return {
    ok: true,
    signature: { target: target.name, kinds, args: params.slice(1).map((one) => one.name) },
  };
}

function written(type: TypeRef): string {
  return type.members.map((member) => (member as { name?: string }).name ?? "?").join(" | ");
}

function needsTarget(name: string): string {
  return `\`deco ${name}\` needs a first parameter — the thing it decorates.`;
}

function needsType(name: string, target: string): string {
  const kinds = everyKindWritten();
  return `\`deco ${name}\` must say what it decorates: give \`${target}\` a type — ${kinds}.`;
}

function notAKind(name: string, type: TypeRef): string {
  const kinds = everyKindWritten();
  return `\`deco ${name}\` decorates \`${written(type)}\`, which is not a kind — say ${kinds}.`;
}
