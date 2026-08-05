import type { Secret } from "./secret-provider.types.js";

/**
 * What every serialised secret collapses to.
 *
 * One spelling, in English like every other word the tools print. It read
 * `‹redigido›` here while the SDK README and the editor's own redaction both
 * said `‹redacted›`, so a reader grepping a report for the marker found two
 * thirds of it.
 */
export const REDACTED = "‹redacted›";

/**
 * Wrap a raw value so it cannot leak through `toString` or `toJSON`.
 *
 * @param args.reveal - the raw value, reachable only via `Secret.reveal()`.
 */
export function makeSecret(args: { reveal: string }): Secret {
  return {
    reveal: () => args.reveal,
    toString: () => REDACTED,
    toJSON: () => REDACTED,
  };
}
