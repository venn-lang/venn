import type { Port } from "../../port/index.js";
import type { ProcessProvider } from "./process-provider.types.js";

/**
 * The {@link ProcessProvider} contract. Implementations: `node-spawn`,
 * `fake-process`.
 */
export const ProcessProviderPort: Port<ProcessProvider> = {
  id: "venn.port.process",
  version: 1,
  requires: ["process"],
  methods: ["spawn"],
};
