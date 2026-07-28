import type { PreviewFrame, PreviewProvider } from "../port/index.js";

function startStream(streaming: Set<number>, worker: number): Promise<void> {
  streaming.add(worker);
  return Promise.resolve();
}

function stopStream(streaming: Set<number>, worker: number): Promise<void> {
  streaming.delete(worker);
  return Promise.resolve();
}

function cannedFrame(worker: number): PreviewFrame {
  return {
    seq: worker + 1,
    width: 1280,
    height: 800,
    mime: "image/jpeg",
    data: "ZmFrZS1mcmFtZQ==",
  };
}

/**
 * The in-memory `PreviewProvider`. Hands back a fixed JPEG for any worker that
 * has been started, and nothing for one that has not.
 *
 * @returns a fresh provider with no worker streaming.
 */
export function createFakePreviewProvider(): PreviewProvider {
  const streaming = new Set<number>();
  return {
    start: (target) => startStream(streaming, target.worker),
    stop: (target) => stopStream(streaming, target.worker),
    latestFrame: (target) =>
      streaming.has(target.worker) ? cannedFrame(target.worker) : undefined,
  };
}
