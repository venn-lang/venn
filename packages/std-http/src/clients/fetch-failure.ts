/**
 * Reading what `fetch` threw, which is the one part of the translation that has
 * to match the host runtime rather than the language.
 *
 * `fetch` reports every network failure the same way, as `TypeError: fetch
 * failed`, and puts the reason on `cause`: an errno for a socket that would not
 * connect, an undici error for a deadline it passed. A failure this file cannot
 * name is handed back untouched, so an unknown one arrives as itself instead of
 * wearing a code that says something specific and false.
 */

import { type Attempt, portNotAllowed, requestFailed } from "./http-client.errors.js";

/** What the failure was, including the one case that is not a plain HttpFailure. */
type Reason = "refused" | "not-found" | "timeout" | "bad-port";

/** The errno or undici code on `cause`, and what it means for the request. */
const REASONS: Readonly<Record<string, Reason>> = {
  ECONNREFUSED: "refused",
  ENOTFOUND: "not-found",
  EAI_AGAIN: "not-found",
  ETIMEDOUT: "timeout",
  UND_ERR_CONNECT_TIMEOUT: "timeout",
  UND_ERR_HEADERS_TIMEOUT: "timeout",
  UND_ERR_BODY_TIMEOUT: "timeout",
};

/** What a rejected `fetch` carries: the reason is on `cause`, one level down. */
interface Rejection {
  name?: string;
  cause?: { code?: string; message?: string; errors?: readonly { code?: string }[] };
}

/**
 * Whatever the request threw, as the error to raise.
 *
 * @param args.attempt The request that failed, and how long it had been running.
 * @param args.error Whatever `fetch` rejected with.
 * @returns A `VennError` when the failure has a name, and `args.error` itself
 * when it does not. An aborted request is one of those: a `race` losing is the
 * language cancelling, not the request failing.
 */
export function asRequestError(args: { attempt: Attempt; error: unknown }): unknown {
  const reason = reasonOf(args.error);
  if (reason === undefined) return args.error;
  if (reason === "bad-port") return portNotAllowed(args.attempt);
  return requestFailed({ attempt: args.attempt, failure: reason });
}

function reasonOf(error: unknown): Reason | undefined {
  const rejection = error as Rejection | undefined;
  // `AbortSignal.timeout` rejects with a DOMException, and never reaches `cause`.
  if (rejection?.name === "TimeoutError") return "timeout";
  const cause = rejection?.cause;
  if (!cause) return undefined;
  // A host with both an IPv6 and an IPv4 address fails once per address, and the
  // AggregateError only carries a code of its own when the two agree.
  const code = cause.code ?? cause.errors?.[0]?.code;
  if (code) return REASONS[code];
  return cause.message === "bad port" ? "bad-port" : undefined;
}
