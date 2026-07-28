import { type ActionDefinition, arg, defineAction, z } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { DbClientPort } from "../port/index.js";
import { RowSchema } from "../types/index.js";

const execParams = z.object({ rows: z.array(RowSchema).optional() });

/** `db.exec("TRUNCATE …", { rows })`: mutate the tables and answer with the affected count. */
export const execAction: ActionDefinition = defineAction({
  name: "exec",
  doc: "Execute a mutating statement (TRUNCATE/DELETE/INSERT); returns the affected count.",
  params: execParams,
  args: [arg("sql", t.string, "The statement to run. Placeholders go in the options.")],
  result: t.number,
  run: (ctx, input) =>
    ctx.port(DbClientPort).exec({ sql: String(input.args[0] ?? ""), rows: input.params.rows }),
});
