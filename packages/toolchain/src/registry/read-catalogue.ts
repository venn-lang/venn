import type { Catalogue, Release } from "./registry.types.js";

/**
 * Turns what the registry answered into what this needs to know.
 *
 * A version missing a tarball or an integrity hash is left out rather than
 * carried as half a release: it cannot be installed and cannot be checked, so
 * offering it would only fail later and further away.
 *
 * @param document The parsed registry response, of whatever shape it arrived in.
 * @returns Everything usable in it, which may be nothing.
 */
export function readCatalogue(document: unknown): Catalogue {
  const root = asRecord(document);
  const releases = releasesIn(asRecord(root.versions));
  return {
    versions: Object.keys(releases),
    tags: tagsIn(asRecord(root["dist-tags"])),
    releases,
  };
}

function releasesIn(versions: Record<string, unknown>): Record<string, Release> {
  const found: Record<string, Release> = {};
  for (const [version, entry] of Object.entries(versions)) {
    const release = releaseIn(version, asRecord(entry));
    if (release) found[version] = release;
  }
  return found;
}

function releaseIn(version: string, entry: Record<string, unknown>): Release | undefined {
  const dist = asRecord(entry.dist);
  const tarball = asText(dist.tarball);
  const integrity = asText(dist.integrity);
  if (tarball === undefined || integrity === undefined) return undefined;
  return { version, tarball, integrity };
}

function tagsIn(tags: Record<string, unknown>): Record<string, string> {
  const found: Record<string, string> = {};
  for (const [tag, version] of Object.entries(tags)) {
    const text = asText(version);
    if (text !== undefined) found[tag] = text;
  }
  return found;
}

/** Without a prototype, so a published version called `__proto__` is a key. */
function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) return Object.create(null);
  return Object.assign(Object.create(null), value) as Record<string, unknown>;
}

function asText(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}
