import type { FetchJson } from "./registry.types.js";

/** The abbreviated document: the tags, the versions, and where each one is. */
const ABBREVIATED = "application/vnd.npm.install-v1+json";

/** Long enough for a slow network, short enough that a wedged one gives up. */
const TIMEOUT_MS = 10_000;

/**
 * Fetching over the network, for when this is not a test.
 *
 * Uses the global `fetch`, so nothing here is tied to Node and the package
 * stays runnable anywhere. A response that is not 200 becomes an error naming
 * the status, because "404" and "the registry is down" need different answers
 * from whoever asked.
 *
 * @throws Error when the request fails, times out, or answers with anything
 * other than a 200 holding JSON.
 */
export function createFetchJson(): FetchJson {
  return async (url: string): Promise<unknown> => {
    const answer = await fetch(url, {
      headers: { accept: ABBREVIATED },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!answer.ok) throw new Error(`the registry answered ${answer.status} for ${url}`);
    return answer.json();
  };
}
