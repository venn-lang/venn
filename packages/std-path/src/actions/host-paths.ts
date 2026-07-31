import { type Paths, PathsPort } from "@venn-lang/contracts";
import type { ActionContext } from "@venn-lang/sdk";

/**
 * The spelling this host writes, which every verb here defers to.
 *
 * The port is what makes the separator the host's business: the same program
 * joins with `/` under the editor's worker and with `\` on the machine that
 * runs it, and never says either out loud.
 */
export function paths(ctx: ActionContext): Paths {
  return ctx.port(PathsPort);
}

/** Every argument as text, since a path is text however it was built. */
export function textOf(args: readonly unknown[]): string[] {
  return args.filter((part) => part !== null && part !== undefined).map(String);
}

/** One argument as text, where nothing at all reads as the empty path. */
export function text(value: unknown): string {
  return String(value ?? "");
}
