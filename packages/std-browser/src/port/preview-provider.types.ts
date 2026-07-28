/** Which worker's frame stream a call targets. Workers stream independently. */
export interface PreviewTarget {
  worker: number;
}

/** One captured frame, encoded in `data` under the stated `mime`. */
export interface PreviewFrame {
  /** Rises by one per frame, so a consumer can tell a repeat from a fresh capture. */
  seq: number;
  width: number;
  height: number;
  mime: string;
  data: string;
}

/**
 * What feeds a live view of a running browser.
 *
 * Two strategies exist behind it: a screencast, which only CDP engines offer,
 * and polling for everything else.
 */
export interface PreviewProvider {
  /** Begins capturing for a worker. Capturing costs, so nothing streams unstarted. */
  start(target: PreviewTarget): Promise<void>;
  stop(target: PreviewTarget): Promise<void>;
  /** The most recent frame, or `undefined` when the worker is not streaming. */
  latestFrame(target: PreviewTarget): PreviewFrame | undefined;
}
