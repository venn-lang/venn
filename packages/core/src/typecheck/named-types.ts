import type { Document, TypeDecl } from "../generated/ast.js";
import { isTypeDecl } from "../generated/ast.js";
import type { TypeCatalog } from "./catalog.types.js";
import type { TypeContext } from "./context.js";
import { KIND_TYPES } from "./kind-types.js";
import { REGEX_TYPE } from "./regex-type.js";
import type { Type } from "./type.types.js";
import { shapeOf, typeRefToType } from "./type-ref.js";

/** The named types a document declares, such as `type User { … }`, by name. */
export interface NamedTypes {
  get(name: string): Type | undefined;
}

/**
 * Collect every `type` declaration into resolvable record types. A shared table
 * lets one type reference another declared later; an unknown name stays
 * `dynamic`, so annotations never add friction.
 *
 * The decorator kinds are in the table before the file is read: `Fn`, `Flow`
 * and the rest are types like any other, so `deco memoize(target: Fn)` needs no
 * special path to hover, complete and check. A file that declares a type of its
 * own by one of those names wins, because they are a stdlib, not reserved words.
 */
export function collectNamedTypes(
  doc: Document,
  ctx: TypeContext,
  catalog?: TypeCatalog,
  imported?: ReadonlyMap<string, Type>,
): NamedTypes {
  const table = new Map<string, Type>(KIND_TYPES);
  table.set("regex", REGEX_TYPE);
  // Local first, then what a `pub type` in another file published. A file that
  // declares a name of its own keeps it, the way a local binding wins over an
  // imported one.
  const named: NamedTypes = { get: (name) => table.get(name) ?? imported?.get(name) };
  for (const decl of doc.decls.filter(isTypeDecl)) {
    table.set(decl.name, declaredType({ decl, ctx, named, catalog }));
  }
  return named;
}

/** A `type` is either a shape of its own or another name for one. */
function declaredType(args: Scope & { decl: TypeDecl }): Type {
  if (args.decl.alias) return typeRefToType({ ...args, ref: args.decl.alias });
  return recordOf(args);
}

interface Scope {
  ctx: TypeContext;
  named: NamedTypes;
  catalog?: TypeCatalog;
}

/** A record of the declared fields. An optional one reads as `T | null`. */
function recordOf(args: Scope & { decl: TypeDecl }): Type {
  return shapeOf({ ...args, body: args.decl.body });
}
