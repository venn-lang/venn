import type { Document, TypeDecl } from "../generated/ast.js";
import { isTypeDecl } from "../generated/ast.js";
import type { TypeCatalog } from "./catalog.types.js";
import type { TypeContext } from "./context.js";
import { ERROR_TYPE } from "./error-type.js";
import { type ImportedType, isGenericImport } from "./imported-types.js";
import { KIND_TYPES } from "./kind-types.js";
import { REGEX_TYPE } from "./regex-type.js";
import { instantiate, type Scheme } from "./scheme.js";
import { TASK_TYPE } from "./task-type.js";
import type { Type } from "./type.types.js";
import { shapeOf, typeRefToType } from "./type-ref.js";

/** The named types a document declares, such as `type User { … }`, by name. */
export interface NamedTypes {
  get(name: string): Type | undefined;
  /**
   * The one declared with parameters, unfilled.
   *
   * `get` answers with the body already filled by fresh variables, which is what
   * a bare `Box` means. This is for a use site that wrote `Box<string>` and has
   * types to put in.
   */
  generic?(name: string): Scheme | undefined;
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
  imported?: ReadonlyMap<string, ImportedType>,
): NamedTypes {
  const table = new Map<string, Type>(KIND_TYPES);
  table.set("regex", REGEX_TYPE);
  table.set("error", ERROR_TYPE);
  table.set("task", TASK_TYPE);
  // Local first, then what a `pub type` in another file published. A file that
  // declares a name of its own keeps it, the way a local binding wins over an
  // imported one.
  const generics = new Map<string, Scheme>();
  const fromAway = (name: string) => imported?.get(name);
  const named: NamedTypes = {
    get: (name) => filled(anyGeneric(name), ctx) ?? table.get(name) ?? plain(fromAway(name)),
    generic: (name) => anyGeneric(name),
  };
  /** This file's own first, then one another file published. */
  function anyGeneric(name: string): Scheme | undefined {
    const away = fromAway(name);
    return generics.get(name) ?? (away && isGenericImport(away) ? away.generic : undefined);
  }
  for (const decl of doc.decls.filter(isTypeDecl)) {
    if (decl.params.length > 0) generics.set(decl.name, genericOf({ decl, ctx, named, catalog }));
    else table.set(decl.name, declaredType({ decl, ctx, named, catalog }));
  }
  return named;
}

/**
 * A declared generic, as a scheme over its parameters.
 *
 * Each parameter is bound to a variable of its own while the body is read, so
 * `T` inside the body and `T` in the parameter list are the same thing. The
 * scheme quantifies them in written order, which is the order a use site fills
 * them in.
 */
function genericOf(args: Scope & { decl: TypeDecl }): Scheme {
  const vars = args.decl.params.map(() => args.ctx.fresh());
  const table = new Map<string, Type>(args.decl.params.map((name, at) => [name, vars[at] as Type]));
  const inner: NamedTypes = {
    get: (name) => table.get(name) ?? args.named.get(name),
    generic: (name) => args.named.generic?.(name),
  };
  const body = declaredType({ ...args, named: inner });
  return { quantified: vars.map((one) => (one as { id: number }).id), type: body };
}

/** What an imported name is when it is not a generic: the type itself. */
function plain(one: ImportedType | undefined): Type | undefined {
  return one && !isGenericImport(one) ? one : undefined;
}

/** A generic read without arguments is one with a fresh variable for each. */
function filled(scheme: Scheme | undefined, ctx: TypeContext): Type | undefined {
  return scheme ? instantiate(scheme, ctx) : undefined;
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
