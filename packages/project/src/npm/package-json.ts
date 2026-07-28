import type { Dependency, Manifest } from "@venn/contracts";

/**
 * The `package.json` a package manager is shown, generated from `venn.toml`.
 *
 * Nobody edits it and nobody commits it: the manifest is the source, this is
 * what the tool underneath happens to read. It is written into `target/`, and
 * that placement is the whole trick: a manager writes `node_modules` beside the
 * `package.json` it was pointed at, so the modules land in
 * `target/node_modules` with nothing fighting anything.
 *
 * @param args.members Their dependencies are merged in too, when the root is a
 * workspace.
 * @returns The file's text, marked private, with path dependencies left out and
 * `[patch]` turned into `overrides`.
 */
export function packageJsonFor(args: {
  manifest: Manifest;
  /** Every member's dependencies as well, when the root is a workspace. */
  members?: readonly Manifest[];
}): string {
  const all = [args.manifest, ...(args.members ?? [])];
  const body = {
    name: `${args.manifest.name || "venn-project"}-target`,
    private: true,
    type: "module",
    dependencies: merged(all.flatMap((one) => one.dependencies)),
    devDependencies: merged(all.flatMap((one) => one.devDependencies)),
    ...overrides(args.manifest.patch),
  };
  return `${JSON.stringify(body, null, 2)}\n`;
}

/**
 * The versions asked for, by name.
 *
 * A dependency on a path is not the package manager's business: it is another
 * package in this workspace, resolved by the language, and handing it over as a
 * version range would send the tool looking for it in the registry.
 */
function merged(deps: readonly Dependency[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const dep of deps) {
    if (dep.path !== undefined) continue;
    out[dep.name] = dep.version ?? "*";
  }
  return sorted(out);
}

/** `[patch]`: the version this project insists on, wherever it is asked for. */
function overrides(patch: readonly Dependency[]): { overrides?: Record<string, string> } {
  const found = merged(patch);
  return Object.keys(found).length > 0 ? { overrides: found } : {};
}

/** Written in name order, so regenerating it produces no diff of its own. */
function sorted(entries: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)));
}
