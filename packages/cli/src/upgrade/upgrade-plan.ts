import type { InstallSite, PackageManager } from "./upgrade.types.js";

/** The published name, which is what a manager is asked to install. */
export const PACKAGE_NAME = "@venn-lang/cli";

/**
 * How each manager is told to install the latest version globally.
 *
 * @returns The command as its argument list, or nothing when the manager is
 * unknown and guessing would be worse than saying so.
 */
export function upgradeCommandFor(manager: PackageManager): readonly string[] | undefined {
  if (manager === "npm") return ["npm", "install", "-g", `${PACKAGE_NAME}@latest`];
  if (manager === "pnpm") return ["pnpm", "add", "-g", `${PACKAGE_NAME}@latest`];
  if (manager === "bun") return ["bun", "add", "-g", `${PACKAGE_NAME}@latest`];
  if (manager === "yarn") return ["yarn", "global", "add", `${PACKAGE_NAME}@latest`];
  return undefined;
}

/** Why an upgrade cannot proceed, phrased for the person who typed the command. */
export function refusalFor(site: InstallSite): string | undefined {
  if (site.manager === "unknown") {
    return [
      "Cannot tell how this copy of venn was installed, so it will not guess.",
      `Reinstall it with your package manager, for example: npm install -g ${PACKAGE_NAME}@latest`,
    ].join("\n");
  }
  if (!site.global) {
    return [
      "This copy belongs to the project, not to you.",
      `Its version is pinned in package.json, so upgrading here would be undone by the next install.`,
      `Update it there instead: ${site.manager} ${site.manager === "npm" ? "install" : "add"} -D ${PACKAGE_NAME}@latest`,
    ].join("\n");
  }
  return undefined;
}
