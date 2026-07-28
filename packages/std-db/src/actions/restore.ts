import { type ActionDefinition, arg, defineAction } from "@venn/sdk";
import { t } from "@venn/types";
import { DbClientPort, type DbSnapshot } from "../port/index.js";

/** `db.restore(snapshot)`: put the tables back as `db.snapshot` found them. */
export const restoreAction: ActionDefinition = defineAction({
  name: "restore",
  doc: "Restore a previously captured snapshot.",
  args: [arg("snapshot", t.ref("db.Tables"), "What `db.snapshot` gave back.")],
  result: t.void,
  run: (ctx, input) => ctx.port(DbClientPort).restore(input.args[0] as DbSnapshot),
});
