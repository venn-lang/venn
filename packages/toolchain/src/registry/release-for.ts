import { selectVersion } from "../resolve/index.js";
import type { Catalogue, Release } from "./registry.types.js";

/**
 * Which published release answers a request.
 *
 * A tag is looked up first, so `latest` means what the registry says it means
 * rather than being read as a version that happens to be spelled oddly. Anything
 * else is a range, and the newest published version satisfying it wins, by the
 * same rule that picks among installed ones.
 *
 * @param catalogue What the registry offered.
 * @param request A version, a range, or a tag such as `latest`.
 * @returns The release to fetch, or nothing when the registry has none.
 */
export function releaseFor(args: { catalogue: Catalogue; request: string }): Release | undefined {
  const tagged = args.catalogue.tags[args.request];
  if (tagged !== undefined) return args.catalogue.releases[tagged];
  const chosen = selectVersion({
    request: { range: args.request, source: "none", from: undefined },
    installed: args.catalogue.versions,
  });
  return chosen.version === undefined ? undefined : args.catalogue.releases[chosen.version];
}

/**
 * What to say when nothing answers, which is usually a typo or a version that
 * has not been published yet.
 */
export function nothingPublishedFor(args: { catalogue: Catalogue; request: string }): string {
  const { versions, tags } = args.catalogue;
  if (versions.length === 0) return "the registry lists no versions of the language";
  const newest = tags.latest ?? versions[versions.length - 1];
  return `no published version matches ${args.request}. The newest is ${newest}`;
}
