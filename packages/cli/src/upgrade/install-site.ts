import type { InstallSite, PackageManager } from "./upgrade.types.js";

/**
 * Where each manager keeps what it installed for the user rather than for a
 * project. A copy under one of these is global wherever it was invoked from,
 * which matters because several live under the home directory: running from `~`
 * would otherwise make a global install look like a project's.
 *
 * The list cannot be complete on its own, since npm follows wherever a version
 * manager puts node. {@link isBesideNode} covers what it cannot name.
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
 * @param path Where the running CLI lives. Must be a plain path: pass
 * `fileURLToPath(import.meta.url)`, since a `file:///` URL would be read as
 * living outside every project.
 * @param cwd The directory the user invoked it from.
 * @param nodePath The node binary running this, from `process.execPath`.
 * @returns The manager and whether the install is global, or `unknown` when the
 * path matches nothing recognisable.
 */
export function installSiteOf(args: { path: string; cwd: string; nodePath: string }): InstallSite {
  const path = normalise(args.path);
  const manager = managerOf(path);
  if (!manager) return { manager: "unknown", global: false };
  const cwd = normalise(args.cwd);
  const node = normalise(args.nodePath);
  return { manager, global: isGlobal({ path, cwd, node }) };
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
 * unless it sits somewhere only a global install can be.
 *
 * Upgrading a copy the project owns would move a version its manifest still
 * pins, so the next install would put the old one back and the user would be
 * left wondering which of the two is running.
 */
function isGlobal(args: { path: string; cwd: string; node: string }): boolean {
  if (GLOBAL_ROOTS.some((root) => args.path.includes(root))) return true;
  if (args.path.includes("/yarn/") && args.path.includes("/global/")) return true;
  if (isBesideNode(args.path, args.node)) return true;
  return !args.path.startsWith(`${args.cwd}/`);
}

/**
 * npm keeps its global packages beside the node binary: alongside it on
 * Windows, under a sibling `lib` elsewhere.
 *
 * Asked of node rather than matched against a list of directory names, because
 * a version manager puts node wherever it likes and the global root follows it
 * there. `C:\nvm4w\nodejs` is a link to `AppData\Local\nvm\v24.17.0`, which
 * node resolves before anything here sees it, and no list would have had that
 * name in it. The upgrade then read every global install as a project's and
 * refused to touch it.
 */
function isBesideNode(path: string, node: string): boolean {
  const directory = parentOf(node);
  if (directory === "") return false;
  if (path.startsWith(`${directory}/node_modules/`)) return true;
  return path.startsWith(`${parentOf(directory)}/lib/node_modules/`);
}

function parentOf(path: string): string {
  const at = path.lastIndexOf("/");
  return at === -1 ? "" : path.slice(0, at);
}
