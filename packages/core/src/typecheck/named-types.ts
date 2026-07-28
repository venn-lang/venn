import type { Document, TypeDecl } from "../generated/ast.js";
import { isTypeDecl } from "../generated/ast.js";
import type { TypeCatalog } from "./catalog.types.js";
import type { TypeContext } from "./context.js";
import { KIND_TYPES } from "./kind-types.js";
import { NULL, record, type Type, union } from "./type.types.js";
import { typeRefToType } from "./type-ref.js";

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
): NamedTypes {
  const table = new Map<string, Type>(KIND_TYPES);
  const named: NamedTypes = { get: (name) => table.get(name) };
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
  const fields = new Map<string, Type>();
  for (const field of args.decl.body?.fields ?? []) {
    const type = typeRefToType({ ...args, ref: field.fieldType });
    fields.set(field.name, field.optional ? union([type, NULL]) : type);
  }
  return record(fields);
}
