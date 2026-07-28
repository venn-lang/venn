import { evaluate, type IfStmt, isIfStmt, truthy } from "@venn-lang/core";
import type { Scope } from "../scope/index.js";
import type { Engine } from "./engine.types.js";
import type { Pending } from "./pending.types.js";
import { runBlock } from "./run-block.js";
import { isPending } from "./settled.js";

/** `if cond { … } else if … else { … }`: evaluate and run the taken branch. */
export function runIf(engine: Engine, stmt: IfStmt, scope: Scope): Pending {
  const cond = evaluate(stmt.cond, scope);
  if (isPending(cond)) return cond.then((value) => void taken(engine, stmt, scope, truthy(value)));
  return taken(engine, stmt, scope, truthy(cond));
}

function taken(engine: Engine, stmt: IfStmt, scope: Scope, yes: boolean): Pending {
  if (yes) return runBlock(engine, stmt.then, scope.child());
  const branch = stmt.otherwise;
  if (!branch) return undefined;
  if (isIfStmt(branch)) return runIf(engine, branch, scope);
  return runBlock(engine, branch, scope.child());
}
