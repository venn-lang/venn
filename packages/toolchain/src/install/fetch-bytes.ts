import type { FetchBytes } from "./install-version.js";

/** A tarball is small, and a stalled connection should not hold a command open. */
const TIMEOUT_MS = 60_000;

/**
 * Downloading over the network, for when this is not a test.
 *
 * @throws Error naming the status when the response is not a 200.
 */
export function createFetchBytes(): FetchBytes {
  return async (url: string): Promise<Uint8Array> => {
    const answer = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!answer.ok) throw new Error(`the registry answered ${answer.status} for ${url}`);
    return new Uint8Array(await answer.arrayBuffer());
  };
}
