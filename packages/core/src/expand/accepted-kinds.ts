import type { DecoDecl, Param } from "../generated/ast.js";
import { isTargetKind, type TargetKind } from "./handles/index.js";

/** The parameter that *is* the target: the first one, always. */
export function decoTarget(decl: DecoDecl): Param | undefined {
  return decl.params?.params[0];
}

/**
 * The kinds a `deco` decorates, read off the type on its first parameter.
 *
 * The signature is the only statement of what a decorator is for; a separate
 * list of node names would drift from it. Empty means the signature never said
 * (no parameter, or one typed with something that is not a kind). That fault is
 * reported where the `deco` is declared, so a use site stays quiet about a
 * mistake it did not make.
 *
 * @returns the kinds the first parameter's type names, in written order.
 */
export function acceptedKinds(decl: DecoDecl): readonly TargetKind[] {
  const written = decoTarget(decl)?.paramType?.members ?? [];
  return written.map((member) => (member as { name?: string }).name ?? "").filter(isTargetKind);
}
