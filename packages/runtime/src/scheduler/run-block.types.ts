import type { Block, Statement } from "@venn-lang/core";
import type { Scope } from "../scope/index.js";
import type { Engine } from "./engine.types.js";

/**
 * A block whose statements are branches, and what to do with them.
 *
 * `run` is handed the engine the branches go on, which carries what wraps each
 * step under them, and the statements that are branches: the block's own hooks
 * are not among them, because a hook is not a branch.
 */
export interface Branching {
  engine: Engine;
  block: Block;
  scope: Scope;
  run: (each: { engine: Engine; stmts: readonly Statement[] }) => Promise<void>;
}
