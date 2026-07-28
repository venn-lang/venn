import type { Port } from "@venn/contracts";
import type { DbClient } from "./db-client.types.js";

/**
 * The port every `db` verb reaches the database through.
 *
 * Bound by the host to `createFakeDbClient` or `createRealDbClient`. Requires
 * the `net` capability, so a host without it is refused at load time rather
 * than failing mid-run.
 */
export const DbClientPort: Port<DbClient> = {
  id: "venn.port.db-client",
  version: 1,
  requires: ["net"],
  methods: ["connect", "query", "exec", "seed", "snapshot", "restore"],
};
