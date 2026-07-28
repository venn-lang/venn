import { defaultManifest } from "./default-manifest.js";
import type { Manifest, ManifestProvider } from "./manifest.types.js";

/**
 * The double: a preset manifest, with no file involved.
 *
 * Takes only what the caller cares about. The rest is what a project that
 * declared nothing would get, which is exactly what the real provider gives a
 * `venn.toml` silent on those tables.
 */
export function createMemoryManifest(args: { manifest: Partial<Manifest> }): ManifestProvider {
  const manifest: Manifest = defaultManifest(args.manifest);
  return { load: () => manifest };
}
