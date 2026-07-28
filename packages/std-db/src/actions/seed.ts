import { type ActionDefinition, type ActionInput, arg, defineAction } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { DbClientPort, type SeedData } from "../port/index.js";

/** `db.seed(data)`: load rows into the tables and answer with how many were loaded. */
export const seedAction: ActionDefinition = defineAction({
  name: "seed",
  doc: "Load rows into the in-memory tables, grouped by table name.",
  args: [arg("tables", t.ref("db.Tables"), "Rows to load, grouped by table name.")],
  result: t.number,
  run: (ctx, input) => ctx.port(DbClientPort).seed(readSeedData(input)),
});

/**
 * Read the tables from either call shape.
 *
 * `db.seed baseline` passes them positionally. Written inline, `db.seed { … }`
 * puts them in the options map instead, and no signature parameter names those.
 */
function readSeedData(input: ActionInput<unknown>): SeedData {
  const positional = input.args[0];
  if (positional && typeof positional === "object") return positional as SeedData;
  return (input.params ?? {}) as SeedData;
}
