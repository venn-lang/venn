import {
  answers,
  evaluate,
  type MatchArm,
  type MatchExpr,
  type Pattern,
  patternSlots,
  patternTests,
  readPath,
  truthy,
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
  for (const arm of stmt.arms) {
    const way = arm.patterns.find((one) => answers(value, patternTests(one)));
    if (!way) continue;
    const child = bound(way, scope, value);
    // The guard is asked with the names in hand, and a no moves on to the next
    // arm rather than ending the match.
    if (arm.guard && !truthy(evaluate(arm.guard, child))) continue;
    return run(engine, arm, child);
  }
  return undefined;
}

/** The scope the arm runs in: what the way it was reached named, over the outer. */
function bound(way: Pattern, scope: Scope, value: unknown): Scope {
  const child = scope.child();
  for (const slot of patternSlots(way)) {
    child.set(slot.name, readPath(value, slot.path));
  }
  return child;
}

function run(engine: Engine, arm: MatchArm, child: Scope): Pending {
  if (arm.body) return runBlock(engine, arm.body, child);
  return arm.value ? void evaluate(arm.value, child) : undefined;
}
