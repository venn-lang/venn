import type { Port } from "@venn/contracts";
import type { LoadRunner } from "./load-runner.types.js";

/**
 * The port `load.run` drives traffic through. Requires the `net` capability, so
 * a host without it fails to load the plugin rather than failing mid-run.
 */
export const LoadRunnerPort: Port<LoadRunner> = {
  id: "venn.port.load-runner",
  version: 1,
  requires: ["net"],
  methods: ["run"],
};
