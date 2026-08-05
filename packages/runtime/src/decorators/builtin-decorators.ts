import { type DecoratorDefinition, durationMs, type ExpandContext } from "@venn-lang/core";
import type { RetrySpec } from "../scheduler/annotations.js";

/** Where each of these may sit. Named once, so a wrong target is caught, not ignored. */
const RUNNABLE = ["FlowDecl", "StepDecl", "GroupDecl"] as const;

/**
 * The decorators the language ships with, written the same way anyone else's
 * are. They go through the same expansion as a plugin decorator and leave
 * metadata on the node, because `@retry(2)` says something the grammar has no
 * other word for. Keeping them here rather than as special cases in the
 * scheduler is what makes the built-ins a stdlib instead of reserved words.
 */
export const builtinDecorators: readonly DecoratorDefinition[] = [
  flag("skip", "Do not run this."),
  flag("only", "Run this and nothing beside it."),
  flag("serial", "Never run this alongside another flow."),
  {
    name: "tags",
    doc: "Label this for `--tags`.",
    targets: [...RUNNABLE],
    expand: (ctx) =>
      ctx.meta(
        "tags",
        ctx.args.map(String).filter((tag) => tag !== ""),
      ),
  },
  {
    name: "timeout",
    doc: "Give up after this long.",
    targets: [...RUNNABLE],
    expand: (ctx) => ctx.meta("timeout", durationMs(ctx.args[0])),
  },
  {
    name: "retry",
    doc: "Run again on failure, up to n times.",
    targets: [...RUNNABLE],
    expand: (ctx) => ctx.meta("retry", retryOf(ctx)),
  },
  {
    name: "lock",
    doc: "Hold this name for the duration; nothing else holding it runs.",
    targets: [...RUNNABLE],
    expand: (ctx) => ctx.meta("lock", ctx.args[0] === undefined ? undefined : String(ctx.args[0])),
  },
  {
    name: "flaky",
    doc: "Tolerate failures up to this ratio.",
    targets: [...RUNNABLE],
    expand: (ctx) => ctx.meta("flaky", ratioOf(ctx.args[0])),
  },
];

/** A decorator with nothing to say beyond having been written. */
function flag(name: string, doc: string): DecoratorDefinition {
  return {
    name,
    doc,
    targets: [...RUNNABLE],
    expand: (ctx) => ctx.meta(name, true),
  };
}

function retryOf(ctx: ExpandContext): RetrySpec {
  const opts = asRecord(ctx.args[1]);
  return {
    attempts: Math.max(0, Math.floor(Number(ctx.args[0]) || 0)),
    backoffMs: durationMs(opts.backoff) ?? 0,
    factor: Number(opts.factor ?? 1) || 1,
  };
}

/** A bare `@flaky` tolerates everything; a number is the ratio it tolerates. */
function ratioOf(value: unknown): number {
  if (value === undefined) return 1;
  return typeof value === "number" ? value : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}
