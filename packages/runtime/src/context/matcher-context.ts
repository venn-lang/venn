import type { ActionContext, MatcherContext } from "@venn-lang/sdk";

/**
 * Narrow what an action is handed down to what a matcher is handed.
 *
 * A matcher answers a question about two values and puts the answer into words.
 * It has no business reaching a port, a secret or the document's config, so it
 * gets `log` and `show` and nothing else.
 *
 * `show` is taken from the action's context rather than bound again from `core`,
 * which is what keeps a failure line and a `print` two lines above it on one
 * renderer: a run has a single `show`, and both sides reach that one.
 *
 * @param ctx The context the runner built for actions.
 * @returns The two members a matcher may use, forwarding to that same context.
 */
export function createMatcherContext(ctx: ActionContext): MatcherContext {
  return {
    log: (message) => ctx.log(message),
    show: (value) => ctx.show(value),
  };
}
