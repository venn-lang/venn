import type { Port } from "../../port/index.js";
import type { ManifestProvider } from "./manifest.types.js";

/**
 * The {@link ManifestProvider} contract. Implementations: `toml-manifest`,
 * `memory-manifest`.
 *
 * Requires nothing: reading the file is the caller's job, and what arrives here
 * is already text.
 */
export const ManifestProviderPort: Port<ManifestProvider> = {
  id: "venn.port.manifest",
  version: 1,
  requires: [],
  methods: ["load"],
};
