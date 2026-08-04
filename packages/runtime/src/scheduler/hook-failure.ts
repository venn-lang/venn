import { buildProblem, CODES, type LifecycleDecl, type Problem } from "@venn-lang/core";
import type { Engine } from "./engine.types.js";
import { nodeSpan } from "./node-span.js";
import { claim, reportProblem } from "./report-failure.js";

/**
 * A lifecycle block that failed: `setup`, `teardown`, `defer`, or an `on`
 * handler.
 *
 * Counted where a failing flow is counted, and carried on the envelope every
 * reporter reads for a failure that is not an assertion. A failure the reporters
 * never hear about ends as a green artifact over a broken run, and one that
 * replaces the error already unwinding sends the reader to the wrong file.
 *
 * One failure is one failure. The hook is the outer name for whatever went
 * wrong inside it, so this claims the throw and relabels it VN7004: `setup {
 * expect false }` is one thing to fix, and printing it twice under two codes,
 * counted twice, is a run that cannot say how many failures it had. Where a
 * frame below already reported it under its own name, that name is the better
 * one and this says nothing, because a second envelope carrying the same
 * failure has every reporter drawing two.
 *
 * @param args.engine The frame the hook ran in.
 * @param args.hook The block as written.
 * @param args.error Whatever it threw.
 */
export function recordHookFailure(args: {
  engine: Engine;
  hook: LifecycleDecl;
  error: unknown;
}): void {
  if (!claim(args.error)) return;
  reportProblem({ engine: args.engine, problem: hookProblem(args), kind: "failure" });
}

function hookProblem(args: { engine: Engine; hook: LifecycleDecl; error: unknown }): Problem {
  return buildProblem({
    spec: CODES.VN7004_HOOK_FAILED,
    span: nodeSpan(args.hook, args.engine.uri),
    title: `${hookLabel(args.hook)} failed: ${messageOf(args.error)}`,
  });
}

/** The block named the way the user wrote it: `setup`, `defer`, or `on failure`. */
function hookLabel(hook: LifecycleDecl): string {
  return hook.hook ?? (hook.event ? `on ${hook.event}` : "lifecycle");
}

function messageOf(error: unknown): string {
  return (error as { message?: string })?.message ?? String(error);
}
