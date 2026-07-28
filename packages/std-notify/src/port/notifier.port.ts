import type { Port } from "@venn-lang/contracts";
import type { Notifier } from "./notifier.types.js";

/**
 * The port every `notify` verb dispatches through. Requires the `net`
 * capability, so a host without it fails to load the plugin rather than
 * failing mid-run.
 */
export const NotifierPort: Port<Notifier> = {
  id: "venn.port.notifier",
  version: 1,
  requires: ["net"],
  methods: ["send"],
};
