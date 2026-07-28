import type { Port } from "../../port/index.js";
import type { SecretProvider } from "./secret-provider.types.js";

/**
 * The {@link SecretProvider} contract. Implementations: `env-secrets`,
 * `memory-secrets`.
 */
export const SecretProviderPort: Port<SecretProvider> = {
  id: "venn.port.secrets",
  version: 1,
  requires: ["secrets"],
  methods: ["get", "has"],
};
