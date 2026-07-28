import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { bold, dim } from "../reporters/colors.js";
import { installSiteOf } from "../upgrade/install-site.js";
import { isNewer, latestVersion } from "../upgrade/latest-version.js";
import type { InstallSite, UpgradeOptions } from "../upgrade/upgrade.types.js";
import { runUpgrade } from "../upgrade/upgrade-command.js";
import { refusalFor, upgradeCommandFor } from "../upgrade/upgrade-plan.js";

/**
 * `venn upgrade`: move a global install to the latest published version.
 *
 * Nothing is changed without saying what will run and asking first, because a
 * command that rewrites what is on the machine has to be one the user chose.
 *
 * @param version The version running now, compared against the registry.
 * @returns 0 when already current or the upgrade succeeded, 1 otherwise.
 */
export async function upgradeCommand(args: {
  version: string;
  options: UpgradeOptions;
}): Promise<number> {
  const site = currentSite();
  const refusal = refusalFor(site);
  if (refusal) return fail(refusal);

  const latest = await latestVersion();
  if (!latest) return fail("Could not reach the registry to check for a newer version.");

  if (!isNewer({ current: args.version, candidate: latest })) {
    process.stdout.write(`venn ${args.version} is already the latest.\n`);
    return 0;
  }
  return upgradeTo({ latest, site, options: args.options, version: args.version });
}

/**
 * `fileURLToPath`, not the URL itself: the site is decided by comparing against
 * the working directory, and "file:///c:/x" never starts with "c:/x", which made
 * every install inside a project look global.
 */
function currentSite(): InstallSite {
  return installSiteOf({ path: fileURLToPath(import.meta.url), cwd: process.cwd() });
}

function fail(message: string): number {
  process.stderr.write(`${message}\n`);
  return 1;
}

async function upgradeTo(args: {
  latest: string;
  site: InstallSite;
  options: UpgradeOptions;
  version: string;
}): Promise<number> {
  const command = upgradeCommandFor(args.site.manager)?.join(" ") ?? "";
  process.stdout.write(`${bold(`venn ${args.version}`)} ${dim("->")} ${bold(args.latest)}\n`);
  process.stdout.write(`${dim(command)}\n`);
  if (!(args.options.yes || args.options.dryRun) && !(await confirmed())) {
    process.stdout.write("Nothing was changed.\n");
    return 0;
  }
  const code = await runUpgrade({ site: args.site, options: args.options });
  if (code !== 0) process.stderr.write(permissionHelp(command));
  return code;
}

async function confirmed(): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  const io = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await io.question("Upgrade now? [y/N] ");
  io.close();
  return answer.trim().toLowerCase().startsWith("y");
}

/** The usual cause of a failed global install, said plainly. */
function permissionHelp(command: string): string {
  return [
    "",
    "The upgrade did not complete. A global install often needs elevated rights.",
    `Try running it yourself: ${command}`,
    `Or install where you own the files: npm config set prefix ~/.npm-global`,
    "",
  ].join("\n");
}
