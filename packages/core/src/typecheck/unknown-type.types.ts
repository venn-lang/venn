import type { AstNode } from "langium";
import type { Document } from "../generated/ast.js";
import type { TypeContext } from "./context.js";
import type { ImportedType } from "./imported-types.js";
import type { NamedTypes } from "./named-types.js";

/**
 * A written type annotation naming something no builtin, declaration, import or
 * plugin answers to.
 *
 * Carried from the reader of annotations to the pass that owns the problem list,
 * because the reader owes its caller a type and has nowhere to put a problem.
 */
export interface UnknownTypeName {
  /** The `SingleType` as written, which is where the refusal is drawn. */
  node: AstNode;
  /** The name, qualified as it was written: `banana`, `shop.Order`. */
  name: string;
}

/** What turning the names the annotation reader could not resolve into problems needs. */
export interface UnknownTypeArgs {
  /** The file, for the type names it declares and the names its imports ask for. */
  document: Document;
  /** How a name resolves, for reading a qualified one through its namespace. */
  named: NamedTypes;
  /**
   * The run that read the annotations, for the names it could not resolve.
   *
   * The whole context rather than the list, so `Infer` satisfies this interface
   * as it stands and the one caller stays one line: a pass that grows a field
   * does not grow its call sites.
   */
  ctx: TypeContext;
  /** What the names this file imports turned out to be, when the caller knows. */
  imports?: ReadonlyMap<string, ImportedType>;
  /** Where the file is, for the spans. */
  uri: string;
}
