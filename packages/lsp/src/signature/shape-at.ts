import type { AstNode } from "@venn/core";
import type { LangiumDocument } from "langium";
import type { SymbolCatalog } from "../catalog/index.js";
import { findBinding } from "../document/index.js";
import type { TypeService } from "../types/index.js";
import { callShape } from "./call-shape.js";
import type { CallShape } from "./call-shape.types.js";
import { declaredShape } from "./declared-shape.js";

export interface ShapeAtArgs {
  /** The dotted name being called. */
  path: string;
  /** A node in the calling scope, for looking that name up. */
  host: AstNode | undefined;
  document: LangiumDocument;
  catalog: SymbolCatalog;
  types: TypeService;
}

/**
 * What the callee of `f(…)` takes.
 *
 * One resolver for every kind of callee, so a call reads the same whoever wrote
 * it. A name the file bound wins (a `fn`, a `fragment`, a `const` holding a
 * lambda); otherwise the prelude and the loaded plugins answer. That a local
 * name beats a namespace is the rule the evaluator follows too.
 */
export function shapeAt(args: ShapeAtArgs): CallShape | undefined {
  const head = args.path.split(".")[0];
  if (!head) return undefined;
  const binding = args.host && findBinding(args.host, head);
  if (!binding) return callShape(args.path, args.catalog);
  if (args.path !== head) return undefined;
  return declaredShape({ binding, name: head, document: args.document, types: args.types });
}
