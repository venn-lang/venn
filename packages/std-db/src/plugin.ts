import { definePlugin, type PluginDefinition } from "@venn/sdk";
import { dbActions } from "./actions/index.js";
import { dbTypeDefs, RowSchema } from "./types/index.js";

/**
 * The `db` plugin: connect, query, exec, seed, snapshot and restore.
 *
 * Every verb reaches the database through `DbClientPort`, so the host decides
 * whether that is the fake or a real driver. Loading fails up front unless the
 * host offers the `net` capability.
 */
export const dbPlugin: PluginDefinition = definePlugin({
  name: "@venn/db",
  version: "0.0.0",
  namespace: "db",
  requires: ["net"],
  actions: dbActions,
  types: { Row: RowSchema },
  typeDefs: dbTypeDefs,
});
