import { definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import { dbActions } from "./actions/index.js";
import { dbTypeDefs } from "./types/index.js";

/**
 * The `db` plugin: connect, query, exec, seed, snapshot and restore.
 *
 * Every verb reaches the database through `DbClientPort`, so the host decides
 * whether that is the fake or a real driver. Loading fails up front unless the
 * host offers the `net` capability.
 */
export const dbPlugin: PluginDefinition = definePlugin({
  name: "venn/db",
  namespace: "db",
  requires: ["net"],
  actions: dbActions,
  typeDefs: dbTypeDefs,
});
