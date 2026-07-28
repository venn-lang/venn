import { type ActionDefinition, arg, defineAction, z } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { DbClientPort } from "../port/index.js";
import { RowSchema } from "../types/index.js";

const queryParams = z.object({ where: RowSchema.optional() });

/** `db.query("SELECT …", { where })`: run a SELECT and answer with the matching rows. */
export const queryAction: ActionDefinition = defineAction({
  name: "query",
  doc: "Run a SELECT and return the matching rows.",
  params: queryParams,
  args: [arg("sql", t.string, "The statement to run. Placeholders go in the options.")],
  result: t.list(t.ref("db.Row")),
  run: (ctx, input) =>
    ctx.port(DbClientPort).query({ sql: String(input.args[0] ?? ""), where: input.params.where }),
});
