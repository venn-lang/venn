import type { Port } from "@venn/contracts";
import type { PreviewProvider } from "./preview-provider.types.js";

/**
 * The port a live view of a run pulls frames from. Requires no capability: both
 * implementations here are in-process, so the port loads anywhere.
 */
export const PreviewProviderPort: Port<PreviewProvider> = {
  id: "venn.port.preview-provider",
  version: 1,
  requires: [],
  methods: ["start", "stop", "latestFrame"],
};
