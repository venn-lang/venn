import { childEnv } from "../../expr/closure.js";
import type { EvalEnv } from "../../expr/eval-env.types.js";
import type { Frame } from "../../expr/frame.js";
import type { MatchArm, MatchExpr, Pattern } from "../../generated/ast.js";
import type { PatternSlot } from "../../pattern/index.js";
import {
  answers,
  type PatternTest,
  patternSlots,
  patternTests,
  slotValue,
} from "../../pattern/index.js";
import { truthy } from "../../value/index.js";
import { slotBinder } from "../box.js";
import type { Thunk } from "../compile.types.js";
import { type LexScope, slotOf } from "../lex-scope.js";
import type { CompileIn } from "./fn.js";

/** One arm, ready to run: the ways in, the condition, and what it gives back. */
interface Arm {
  /** One per `|`, tried in order. An arm without any has exactly one. */
  readonly ways: readonly Way[];
  /** The condition after the pattern, which reads what the pattern bound. */
  readonly guard: Thunk | undefined;
  readonly value: Thunk;
}

/** One way an arm can be reached: what it asks, and what it names when it is. */
interface Way {
  readonly tests: readonly PatternTest[];
  readonly binds: readonly Bound[];
}

/** One name an arm binds, and the slot it goes in when the body has a frame. */
interface Bound {
  readonly of: PatternSlot;
  /** -1 where there are no slots, which is anywhere outside a function body. */
  readonly slot: number;
  /** How the slot is filled: in a cell of its own where a closure took it. */
  readonly write: (frame: Frame, value: unknown) => void;
}

/**
 * `match` as a value: the first arm whose questions the subject answers.
 *
 * Arms are read once, here, so running one is a walk down a short list of
 * comparisons rather than another look at the tree. An arm written as a block
 * runs steps and gives nothing back, which the checker refuses where a value is
 * wanted; this answers `null` for it, since something has to be answered.
 */
export function compileMatch(expr: MatchExpr, scope: LexScope, compileIn: CompileIn): Thunk {
  const subject = compileIn(expr.subject, scope);
  const arms = expr.arms.map((arm) => armOf(arm, scope, compileIn));
  return (env) => {
    const value = subject(env);
    for (const arm of arms) {
      const way = arm.ways.find((one) => answers(value, one.tests));
      if (!way) continue;
      const inner = bind(env, way.binds, value);
      // The guard is asked last, with the names in hand, and a no moves on to
      // the next arm rather than ending the match.
      if (arm.guard && !truthy(arm.guard(inner))) continue;
      return arm.value(inner);
    }
    return null;
  };
}

function armOf(arm: MatchArm, scope: LexScope, compileIn: CompileIn): Arm {
  return {
    ways: arm.patterns.map((pattern) => wayOf(pattern, scope)),
    guard: arm.guard ? compileIn(arm.guard, scope) : undefined,
    value: arm.value ? compileIn(arm.value, scope) : NOTHING,
  };
}

function wayOf(pattern: Pattern, scope: LexScope): Way {
  const binds = patternSlots(pattern).map((bound) => {
    const slot = slotOf(scope, bound.name);
    return { of: bound, slot, write: slotBinder(scope, slot) };
  });
  return { tests: patternTests(pattern), binds };
}

const NOTHING: Thunk = () => null;

/**
 * The environment the arm's body runs in.
 *
 * Inside a function the names have slots, like any other local, so the body goes
 * on reading its frame. Anywhere else there is no frame to write to, and the
 * body reads names by asking, so the values are handed over in a scope of their
 * own.
 */
function bind(env: EvalEnv, binds: readonly Bound[], value: unknown): EvalEnv {
  if (binds.length === 0) return env;
  if (binds[0]?.slot === -1) return childEnv(env, held(binds, value));
  for (const bound of binds) bound.write(env as Frame, slotValue(value, bound.of));
  return env;
}

function held(binds: readonly Bound[], value: unknown): Record<string, unknown> {
  const bindings: Record<string, unknown> = {};
  for (const bound of binds) bindings[bound.of.name] = slotValue(value, bound.of);
  return bindings;
}
