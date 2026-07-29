import { rcompare, satisfies, valid, validRange } from "semver";
import type { VersionChoice, VersionRequest } from "./resolve.types.js";

/**
 * Which installed version answers a request.
 *
 * The newest that satisfies, never an arbitrary one: pinning `0.2` and getting
 * `0.2.1` one day and `0.2.7` the next would make a pin worse than no pin.
 *
 * A prerelease only answers a range that asks for one by name. Running on a
 * release candidate is a decision, and it should not happen because somebody
 * wrote `1.x` and a `1.4.0-rc.1` happened to be lying around.
 *
 * @param request What the directory asked for, from `resolveVersion`.
 * @param installed Every version present, in any order.
 * @returns The version to use, absent when nothing installed satisfies, along
 * with everything that did, so a command can say what it found instead.
 */
export function selectVersion(args: {
  request: VersionRequest;
  installed: readonly string[];
}): VersionChoice {
  const usable = args.installed.filter((version) => valid(version) !== null);
  const candidates = usable.filter((version) => answers(version, args.request.range));
  candidates.sort(rcompare);
  return { version: candidates[0], request: args.request, candidates };
}

/** `includePrerelease` stays off, so `1.x` will not quietly pick an rc. */
function answers(version: string, range: string): boolean {
  try {
    return satisfies(version, range);
  } catch {
    return false;
  }
}

/**
 * Whether a range means anything, for telling somebody their pin is nonsense
 * when they write it rather than the next time they run something.
 */
export function isUsableRange(range: string): boolean {
  return validRange(range) !== null;
}
