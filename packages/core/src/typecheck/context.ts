import type { AstNode } from "langium";
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
  /** A unit clash rather than a plain type clash: VN3012 instead of VN3010. */
  unit?: boolean;
}

/** A fresh inference context: variable ids from zero, no mismatches recorded. */
export function createContext(): TypeContext {
  let next = 0;
  return {
    fresh: () => ({ kind: "var", id: next++, ref: undefined }),
    mismatches: [],
  };
}
