import {
  answers,
  evaluate,
  type MatchArm,
  type MatchExpr,
  patternSlots,
  patternTests,
  readPath,
} from "@venn-lang/core";
import type { Scope } from "../scope/index.js";
import type { Engine } from "./engine.types.js";
import type { Pending } from "./pending.types.js";
import { runBlock } from "./run-block.js";
import { isPending } from "./settled.js";

/**
 * `match subject { … }` standing on its own: the first arm whose questions the
 * subject answers runs, and the rest do not.
 *
 * An arm written with `=>` gives a value back, which a statement has nowhere to
 * put and simply drops; one written as a block runs steps, which is what a
 * statement is for.
 */
export function runMatch(engine: Engine, stmt: MatchExpr, scope: Scope): Pending {
  const subject = evaluate(stmt.subject, scope);
  if (isPending(subject)) return subject.then((value) => void taken(engine, stmt, scope, value));
  return taken(engine, stmt, scope, subject);
}

function taken(engine: Engine, stmt: MatchExpr, scope: Scope, value: unknown): Pending {
  const arm = stmt.arms.find((one) => answers(value, patternTests(one.pattern)));
  return arm ? run(engine, arm, scope, value) : undefined;
}

function run(engine: Engine, arm: MatchArm, scope: Scope, value: unknown): Pending {
  const child = scope.child();
  for (const bound of patternSlots(arm.pattern)) {
    child.set(bound.name, readPath(value, bound.path));
  }
  if (arm.body) return runBlock(engine, arm.body, child);
  return arm.value ? void evaluate(arm.value, child) : undefined;
}
