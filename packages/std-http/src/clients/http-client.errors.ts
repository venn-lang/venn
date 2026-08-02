/**
 * What a request that never got an answer says, in the product's voice.
 *
 * The translation lives at the producer, beside the client that raises it, for
 * the same reason `http-server.errors.ts` does: `fetch failed` is the name of a
 * JavaScript function, and no caller should have to read an undici `cause` to
 * learn that nothing was listening.
 */

import { VennError } from "@venn-lang/contracts";
import { PLUGIN_CODES } from "@venn-lang/sdk";
import type { HttpFailure } from "../port/index.js";
import { targetOf } from "./target-of.js";

/** One attempt, as a failure names it: `GET https://api.test/health`. */
export interface Attempt {
  method: string;
  url: string;
  elapsedMs: number;
}

/**
 * The failure for one of the three the port promises, whoever raised it.
 *
 * Both implementations come through here, so the double refuses a connection in
 * exactly the words the real client uses.
 *
 * @param args.attempt The request that failed, and how long it had been running.
 * @param args.failure Which of the three it was.
 * @returns The `VennError` to throw: `VN7022`, `VN7023` or `VN7024`.
 */
export function requestFailed(args: { attempt: Attempt; failure: HttpFailure }): VennError {
  if (args.failure === "not-found") return hostNotFound(args.attempt);
  if (args.failure === "timeout") return requestTimedOut(args.attempt);
  return connectionRefused(args.attempt);
}

/** VN7022: the address was reachable and nothing there accepted the connection. */
export function connectionRefused(attempt: Attempt): VennError {
  const target = targetOf(attempt.url);
  return new VennError({
    code: PLUGIN_CODES.VN7022_CONNECTION_REFUSED,
    message: `Nothing is listening on ${target.authority}, so ${called(attempt)} was refused.`,
    detail: { method: attempt.method, url: attempt.url, target: target.authority },
  });
}

/** VN7022: a port no HTTP client will open, such as 1 or 25, so nothing was tried. */
export function portNotAllowed(attempt: Attempt): VennError {
  const target = targetOf(attempt.url);
  return new VennError({
    code: PLUGIN_CODES.VN7022_CONNECTION_REFUSED,
    message: `Port ${target.port} is one no HTTP client will open, so ${called(attempt)} never went out.`,
    detail: { method: attempt.method, url: attempt.url, port: target.port },
  });
}

/** VN7023: the name did not resolve, so there was nowhere to send it. */
export function hostNotFound(attempt: Attempt): VennError {
  const target = targetOf(attempt.url);
  return new VennError({
    code: PLUGIN_CODES.VN7023_HOST_NOT_FOUND,
    message: `The name ${target.host} did not resolve, so ${called(attempt)} had nowhere to go.`,
    detail: { method: attempt.method, url: attempt.url, host: target.host },
  });
}

/** VN7024: it went out and nothing came back before the time ran out. */
export function requestTimedOut(attempt: Attempt): VennError {
  return new VennError({
    code: PLUGIN_CODES.VN7024_REQUEST_TIMED_OUT,
    message: `${called(attempt)} ran out of time after ${attempt.elapsedMs}ms without an answer.`,
    detail: { method: attempt.method, url: attempt.url, elapsedMs: attempt.elapsedMs },
  });
}

function called(attempt: Attempt): string {
  return `${attempt.method} ${attempt.url}`;
}
