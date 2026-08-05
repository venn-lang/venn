import type { LifecycleDecl } from "@venn-lang/core";
import type { Scope } from "../scope/index.js";
import type { Engine } from "./engine.types.js";
import { recordHookFailure } from "./hook-failure.js";
import { runBlock } from "./run-block.js";
import { ExitSignal, isControlSignal } from "./signals.js";

/**
 * One `defer` or `teardown` body, reported where it failed and not swallowed.
 *
 * Reported, so the reader is told which cleanup could not do its job, with the
 * line and the code a hook failure already carries. Rethrown, so the walk
 * around this collects it: what it must never do is take the place of the error
 * that started the unwind, because that is the one that says why any of this is
 * happening.
 *
 * @throws Whatever the body threw, after recording it as VN7004.
 */
export async function runCleanup(engine: Engine, hook: LifecycleDecl, scope: Scope): Promise<void> {
  // A hook body is not a step of the block that wrote the hook: a `beforeEach`
  // with a step in it would otherwise ask itself to run around that step.
  const inner = engine.each ? { ...engine, each: undefined } : engine;
  try {
    await runBlock(inner, hook.body, scope.child());
  } catch (error) {
    if (!isControlSignal(error)) recordHookFailure({ engine, hook, error });
    throw error;
  }
}

/**
 * Whatever failed, with an `exit` raised rather than kept.
 *
 * `exit` is not cleanup's to absorb: it ends the run, and the code it carries
 * is the whole verdict, so it keeps unwinding to whoever ends it.
 *
 * @param failures What the cleanup walk collected.
 * @returns The same list, once there is no `exit` in it.
 */
export function keepExit(failures: readonly unknown[]): readonly unknown[] {
  const asked = failures.find((one) => one instanceof ExitSignal);
  if (asked) throw asked;
  return failures;
}
