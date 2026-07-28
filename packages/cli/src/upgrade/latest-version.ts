import { PACKAGE_NAME } from "./upgrade-plan.js";

/** How long to wait on the registry before giving up and saying so. */
const TIMEOUT_MS = 5_000;

/**
 * The newest published version, asked of the registry.
 *
 * Only the `dist-tags` document is fetched rather than the full package
 * metadata, which for this package is megabytes of version history nobody
 * asked for.
 *
 * @returns The version under the `latest` tag, or nothing when the registry
 * cannot be reached. Being offline is not an error worth stopping for.
 */
export async function latestVersion(): Promise<string | undefined> {
  const url = `https://registry.npmjs.org/-/package/${encodeURIComponent(PACKAGE_NAME)}/dist-tags`;
  try {
    const answer = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!answer.ok) return undefined;
    const tags = (await answer.json()) as Record<string, string>;
    return typeof tags.latest === "string" ? tags.latest : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Whether `candidate` is a later release than `current`.
 *
 * Compares the numeric parts only. A prerelease is never offered as an upgrade
 * to someone on a stable version, since opting into one is a decision rather
 * than an update.
 */
export function isNewer(args: { current: string; candidate: string }): boolean {
  if (args.candidate.includes("-")) return false;
  const now = parts(args.current);
  const next = parts(args.candidate);
  for (let at = 0; at < 3; at += 1) {
    const a = next[at] ?? 0;
    const b = now[at] ?? 0;
    if (a !== b) return a > b;
  }
  return false;
}

function parts(version: string): number[] {
  const stable = version.split("-")[0] ?? version;
  return stable.split(".").map((piece) => Number.parseInt(piece, 10) || 0);
}
