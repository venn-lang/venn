import type { AstNode } from "langium";
import type { CodeSpec } from "../codes/index.js";
import type { Type, TypeVar } from "./type.types.js";
import type { UnknownTypeName } from "./unknown-type.types.js";

/**
 * Per-run inference state: a fresh-variable source, the type mismatches found,
 * and the annotations naming a type nothing declares. Held in a context (not a
 * module global) so two checks never share variable ids or leak diagnostics
 * into each other.
 */
export interface TypeContext {
  fresh(): TypeVar;
  mismatches: TypeMismatch[];
  /**
   * Written type names that resolved to nothing.
   *
   * Collected here rather than raised where they are read, because the reader
   * of an annotation answers with a type and has no place to put a problem. It
   * is the same sink `mismatches` is, for the same reason.
   */
  unknownTypes: UnknownTypeName[];
}

/** One place where two types could not be made equal, at a source node. */
export interface TypeMismatch {
  node: AstNode;
  expected: Type;
  actual: Type;
  note?: string;
  /**
   * The whole title, for a clash the checker can describe better than the two
   * types can. Used where naming the types explains nothing about the mistake.
   */
  sentence?: string;
  /** The way out, for a mistake that has one the two types do not spell. */
  help?: string;
  /** What to report this under. A plain clash of two types is VN3010. */
  code?: CodeSpec;
}

/** A fresh inference context: variable ids from zero, nothing found yet. */
export function createContext(): TypeContext {
  let next = 0;
  return {
    fresh: () => ({ kind: "var", id: next++, ref: undefined }),
    mismatches: [],
    unknownTypes: [],
  };
}
