import { readCatalogue } from "./read-catalogue.js";
import type { Catalogue, FetchJson } from "./registry.types.js";

/** The published name of the language, which is what gets fetched. */
export const LANGUAGE_PACKAGE = "@venn-lang/cli";

/** npmjs, unless something says otherwise. */
export const DEFAULT_REGISTRY = "https://registry.npmjs.org";

/**
 * What versions of the language exist, and where to get each.
 *
 * Asks for the abbreviated document, which holds the tags, the versions and
 * each tarball with its hash, and nothing else. For this package it is 4 KB
 * where the full one is 21, and the full one grows with every release while
 * this stays the shape it is.
 *
 * @param fetchJson How to fetch, injected so this can be tested without a
 * network and so a different transport does not need it rewritten.
 * @param registry Where to ask, defaulting to npmjs.
 * @returns Everything published that can actually be installed.
 */
export async function catalogueOf(args: {
  fetchJson: FetchJson;
  registry?: string;
}): Promise<Catalogue> {
  const base = args.registry ?? DEFAULT_REGISTRY;
  return readCatalogue(await args.fetchJson(`${base}/${encodeURIComponent(LANGUAGE_PACKAGE)}`));
}
