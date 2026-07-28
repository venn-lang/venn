import type { Port } from "@venn-lang/contracts";
import type { MailClient } from "./mail-client.types.js";

/**
 * The port every `mail` verb reaches through. Requires the `net` capability, so
 * a host without it fails to load the plugin rather than failing mid-run.
 */
export const MailClientPort: Port<MailClient> = {
  id: "venn.port.mail-client",
  version: 1,
  requires: ["net"],
  methods: ["selectInbox", "waitFor", "read", "attachments", "clear"],
};
