import { spawn } from "node:child_process";
import type { InstallSite, UpgradeOptions } from "./upgrade.types.js";
import { upgradeCommandFor } from "./upgrade-plan.js";

/**
 * The shell command that moves this install to the latest version.
 *
 * Runs the manager rather than rewriting files: the CLI cannot replace itself
 * while it is executing, and on Windows the running executable is locked.
 *
 * @returns The exit code of the manager, or 1 when it could not be started.
 */
export function runUpgrade(args: { site: InstallSite; options: UpgradeOptions }): Promise<number> {
  const command = upgradeCommandFor(args.site.manager);
  if (!command) return Promise.resolve(1);
  if (args.options.dryRun) {
    process.stdout.write(`${command.join(" ")}\n`);
    return Promise.resolve(0);
  }
  return spawned(command);
}

function spawned(command: readonly string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command[0] as string, command.slice(1), {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", () => resolve(1));
    child.on("close", (code) => resolve(code ?? 1));
  });
}
