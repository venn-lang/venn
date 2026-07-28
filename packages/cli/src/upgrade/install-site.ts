import type { InstallSite, PackageManager } from "./upgrade.types.js";

/**
 * Where each manager keeps what it installed for the user rather than for a
 * project. A copy sitting under one of these is global wherever it was invoked
 * from, which matters because several of them live under the home directory:
 * running from `~` would otherwise make a global install look like a local one.
 */
const GLOBAL_ROOTS: readonly string[] = [
  "/pnpm/global/",
  "/.bun/install/global/",
  "/bun/install/global/",
  "/lib/node_modules/",
  "/npm/node_modules/",
  "/nodejs/node_modules/",
];

/**
 * Which manager installed this copy, and whether it did so globally.
 *
 * Read from the path the CLI is running out of rather than from the
 * environment: `npm_config_user_agent` only exists while a package script is
 * running, and is empty when the binary is invoked directly, which is every
 * time anyone actually uses it.
 *
 * Each manager keeps its global root somewhere unmistakable, so the path is
 * enough to tell them apart on all three operating systems.
 *
 * @param path Where the running CLI lives. Must be a plain path: pass
 * `fileURLToPath(import.meta.url)`, since a `file:///` URL would be read as
 * living outside every project.
 * @param cwd The directory the user invoked it from.
 * @returns The manager and whether the install is global, or `unknown` when the
 * path matches nothing recognisable.
 */
export function installSiteOf(args: { path: string; cwd: string }): InstallSite {
  const path = normalise(args.path);
  const manager = managerOf(path);
  if (!manager) return { manager: "unknown", global: false };
  return { manager, global: isGlobal(path, normalise(args.cwd)) };
}

function normalise(path: string): string {
  return path.split("\\").join("/").toLowerCase();
}

function managerOf(path: string): PackageManager | undefined {
  if (path.includes("/.bun/") || path.includes("/bun/install/global/")) return "bun";
  if (path.includes("/pnpm/")) return "pnpm";
  if (path.includes("/yarn/") || path.includes("/.yarn/")) return "yarn";
  return path.includes("/node_modules/") ? "npm" : undefined;
}

/**
 * A copy under the working directory belongs to that project, not to the user,
 * unless it sits in a global root that happens to be an ancestor of it.
 *
 * Upgrading a copy the project owns would move a version its manifest still
 * pins, so the next install would put the old one back and the user would be
 * left wondering which of the two is running.
 */
function isGlobal(path: string, cwd: string): boolean {
  if (isGlobalRoot(path)) return true;
  return !path.startsWith(`${cwd}/`);
}

function isGlobalRoot(path: string): boolean {
  if (GLOBAL_ROOTS.some((root) => path.includes(root))) return true;
  return path.includes("/yarn/") && path.includes("/global/");
}
