import type { PreviewProvider } from "../port/index.js";

/**
 * The `PreviewProvider` that captures nothing. The default on CI, where nobody
 * is watching and a frame stream is pure cost.
 *
 * @returns a provider that accepts every call and never yields a frame.
 */
export function createNonePreviewProvider(): PreviewProvider {
  return {
    start: () => Promise.resolve(),
    stop: () => Promise.resolve(),
    latestFrame: () => undefined,
  };
}
