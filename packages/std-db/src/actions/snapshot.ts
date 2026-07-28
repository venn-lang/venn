import { type ActionDefinition, defineAction } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { DbClientPort } from "../port/index.js";

/** `db.snapshot()`: copy the current tables into a value `db.restore` accepts. */
export const snapshotAction: ActionDefinition = defineAction({
  name: "snapshot",
  doc: "Capture the current in-memory state as a restorable snapshot.",
  // `db.Tables`, not `DbSnapshot`: that alias lives in the port's TypeScript, and
  // a script can only name what the plugin publishes.
  result: t.ref("db.Tables"),
  run: (ctx) => ctx.port(DbClientPort).snapshot(),
});
