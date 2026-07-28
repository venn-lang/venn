import type { Manifest } from "./manifest.types.js";
import { DEFAULT_PROFILES } from "./read/index.js";

/**
 * A manifest with nothing declared: what a project without a `venn.toml` is.
 *
 * The one place stating what a project gets for saying nothing at all, so a
 * caller who wants one field need not spell the other dozen.
 *
 * @param overrides - fields to state explicitly. `name` and `version` fall back
 * to `[package]` before falling back to the defaults.
 */
export function defaultManifest(overrides: Partial<Manifest> = {}): Manifest {
  const pkg = { name: "", authors: [], ...overrides.package };
  return {
    name: overrides.name ?? pkg.name,
    version: overrides.version ?? pkg.version ?? "0.0.0",
    package: pkg,
    targets: [],
    dependencies: [],
    devDependencies: [],
    patch: [],
    profiles: { ...DEFAULT_PROFILES },
    tooling: { manager: "pnpm" },
    env: {},
    envFiles: [],
    paths: {},
    format: {},
    ...overrides,
  };
}
