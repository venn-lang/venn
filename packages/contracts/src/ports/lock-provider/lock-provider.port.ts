import type { Port } from "../../port/index.js";
import type { LockProvider } from "./lock-provider.types.js";

/**
 * The {@link LockProvider} contract. Implementations: `in-process-lock`,
 * `fake-lock`.
 *
 * Requires nothing: a mutex is bookkeeping, so it binds even on a host with no
 * capabilities at all.
 */
export const LockProviderPort: Port<LockProvider> = {
  id: "venn.port.lock",
  version: 1,
  requires: [],
  methods: ["acquire"],
};
