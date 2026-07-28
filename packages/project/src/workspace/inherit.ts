import type { Dependency, Manifest, PackageInfo } from "@venn/contracts";

/**
 * A member manifest with what the workspace root supplies filled in.
 *
 * Two things are inherited and they work differently. `[workspace.package]` is
 * a default: the member's own value wins wherever it wrote one. A dependency
 * marked `{ workspace = true }` is a request, so the root's answer replaces
 * whatever was there. Writing both a version and `workspace = true` is a
 * contradiction, and the request is the deliberate half.
 *
 * @param args.from The workspace root's manifest. A root with no `[workspace]`
 * table supplies nothing, and the member is returned untouched.
 * @returns The merged manifest. The member's own `name` always survives.
 */
export function inherit(args: { manifest: Manifest; from: Manifest }): Manifest {
  const shared = args.from.workspace;
  if (!shared) return args.manifest;
  const pkg = withDefaults(args.manifest.package, shared.package);
  return {
    ...args.manifest,
    name: pkg.name,
    version: pkg.version ?? args.manifest.version,
    package: pkg,
    dependencies: pinned(args.manifest.dependencies, shared.dependencies),
    devDependencies: pinned(args.manifest.devDependencies, shared.dependencies),
    ...settings(args.manifest, args.from),
  };
}

/**
 * The environments and path aliases a member gets from its root.
 *
 * A workspace almost always wants `[env.staging]` and `#shared` written once.
 * The alternative, every member repeating every variable, drifts silently until
 * two members disagree about a URL. A member that writes its own key wins, per
 * key rather than per table.
 */
function settings(own: Manifest, root: Manifest): Pick<Manifest, "env" | "paths"> {
  const env: Record<string, Record<string, string>> = { ...root.env };
  for (const [name, vars] of Object.entries(own.env)) env[name] = { ...env[name], ...vars };
  return { env, paths: { ...root.paths, ...own.paths } };
}

/** The member's own value wins; the root fills only what was left unsaid. */
function withDefaults(own: PackageInfo, shared: Partial<PackageInfo>): PackageInfo {
  const merged = { ...own };
  for (const [key, value] of Object.entries(shared) as [keyof PackageInfo, never][]) {
    if (merged[key] === undefined || merged[key] === "") merged[key] = value;
  }
  return { ...merged, name: own.name };
}

function pinned(deps: readonly Dependency[], shared: readonly Dependency[]): readonly Dependency[] {
  return deps.map((dep) => {
    if (!dep.fromWorkspace) return dep;
    const found = shared.find((one) => one.name === dep.name);
    return found ? { ...found, optional: dep.optional, fromWorkspace: true } : dep;
  });
}
