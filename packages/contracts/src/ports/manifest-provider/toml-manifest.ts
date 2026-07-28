import type { Manifest, ManifestProvider } from "./manifest.types.js";
import {
  readDependencies,
  readPackage,
  readProfiles,
  readTargets,
  readTooling,
  readWorkspace,
} from "./read/index.js";
import { readRunSettings } from "./read-run-settings.js";
import { parseToml } from "./toml/index.js";

/**
 * The real one: parse `venn.toml` into a {@link Manifest}.
 *
 * Parsing happens once, at construction, so repeated `load()` calls are free
 * and always agree.
 *
 * @param args.content - the manifest as written.
 */
export function createTomlManifest(args: { content: string }): ManifestProvider {
  const manifest = toManifest(parseToml(args.content));
  return { load: () => manifest };
}

function toManifest(data: Record<string, unknown>): Manifest {
  const pkg = readPackage(data);
  return {
    name: pkg.name,
    version: pkg.version ?? "0.0.0",
    package: pkg,
    targets: readTargets(data, pkg.name),
    dependencies: readDependencies(data.dependencies),
    devDependencies: readDependencies(data["dev-dependencies"]),
    patch: readDependencies(data.patch),
    profiles: readProfiles(data),
    tooling: readTooling(data),
    workspace: readWorkspace(data),
    ...readRunSettings(data),
  };
}
