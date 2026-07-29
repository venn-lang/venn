/** What a published version offers: where to get it, and how to know it arrived intact. */
export interface Release {
  readonly version: string;
  /** Where the tarball is. */
  readonly tarball: string;
  /** `sha512-…`, as the registry publishes it, for checking what was downloaded. */
  readonly integrity: string;
}

/** What the registry knows about the language. */
export interface Catalogue {
  /** Every published version, in the order the registry listed them. */
  readonly versions: readonly string[];
  /** What each tag points at, `latest` among them. */
  readonly tags: Readonly<Record<string, string>>;
  /** Where to get each version, keyed by version. */
  readonly releases: Readonly<Record<string, Release>>;
}

/**
 * How the catalogue is fetched, so a test does not need a network and a
 * different transport does not need this rewritten.
 *
 * @throws When the request cannot be made at all. A response that is not 200 is
 * the implementation's to turn into a message.
 */
export type FetchJson = (url: string) => Promise<unknown>;
