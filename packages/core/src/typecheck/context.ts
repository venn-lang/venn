import type { AstNode } from "langium";
import type { CodeSpec } from "../codes/index.js";
import type { Type, TypeVar } from "./type.types.js";

/**
 * Per-run inference state: a fresh-variable source and the list of type
 * mismatches found. Held in a context (not a module global) so two checks never
 * share variable ids or leak diagnostics into each other.
 */
export interface TypeContext {
  fresh(): TypeVar;
  mismatches: TypeMismatch[];
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

/** A fresh inference context: variable ids from zero, no mismatches recorded. */
export function createContext(): TypeContext {
  let next = 0;
  return {
    fresh: () => ({ kind: "var", id: next++, ref: undefined }),
    mismatches: [],
  };
}
