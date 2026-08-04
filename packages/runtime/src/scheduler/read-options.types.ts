import type { MapLit } from "@venn-lang/core";
import type { Scope } from "../scope/index.js";

/** Where one construct's options are written, and what they are read against. */
export interface ReadOptions {
  opts: MapLit | undefined;
  /** The node type carrying them: `ParallelStmt`, `RaceStmt`, `ForEachStmt`. */
  kind: string;
  scope: Scope;
  uri: string;
}
