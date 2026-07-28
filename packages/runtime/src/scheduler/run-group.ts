import type { GroupDecl } from "@venn/core";
import type { Scope } from "../scope/index.js";
import type { Engine } from "./engine.types.js";
import { runBlock } from "./run-block.js";

/** A group only clusters steps in the graph; it shares the enclosing scope. */
export async function runGroup(engine: Engine, stmt: GroupDecl, scope: Scope): Promise<void> {
  await runBlock(engine, stmt.body, scope);
}
