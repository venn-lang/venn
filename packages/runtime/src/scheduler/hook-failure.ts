import { buildProblem, CODES, type LifecycleDecl, type Problem } from "@venn-lang/core";
import type { Engine } from "./engine.types.js";
import { nodeSpan } from "./node-span.js";

/**
 * A lifecycle block that failed: `setup`, `teardown`, `defer`, or an `on`
 * handler.
 *
 * Counted where a failing flow is counted, and carried on the event that already
 * puts a Problem in front of every reporter. A failure the reporters never hear
 * about ends as a green artifact over a broken run, and one that replaces the
 * error already unwinding sends the reader to the wrong file.
 */
export function recordHookFailure(args: {
  engine: Engine;
  hook: LifecycleDecl;
  error: unknown;
}): void {
  args.engine.result.failed += 1;
  args.engine.emitter.emit({ kind: "expect.failed", data: { problem: hookProblem(args) } });
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
