/** The package managers that can install a global CLI. */
export type PackageManager = "npm" | "pnpm" | "bun" | "yarn" | "unknown";

/** Where a copy of the CLI came from. */
export interface InstallSite {
  manager: PackageManager;
  /** False when the copy belongs to a project rather than to the user. */
  global: boolean;
}

/** What `venn upgrade` was asked to do. */
export interface UpgradeOptions {
  /** Skip the confirmation. For scripts, never for a person. */
  yes?: boolean;
  /** Report what would happen and change nothing. */
  dryRun?: boolean;
}
