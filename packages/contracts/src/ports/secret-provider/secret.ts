import type { Secret } from "./secret-provider.types.js";

/** What every serialised secret collapses to. */
export const REDACTED = "‹redigido›";

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
