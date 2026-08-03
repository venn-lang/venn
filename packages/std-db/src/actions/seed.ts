import {
  type ActionDefinition,
  type ActionInput,
  defineAction,
  optionalArg,
  z,
} from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { DbClientPort, type SeedData } from "../port/index.js";

/**
 * Every key is a table name, so the map is free-form.
 *
 * Declared, rather than left off, because `readSeedData` reads it: a verb that
 * takes no options had its own README refused with VN5007 for writing the call
 * the way the verb works.
 */
const params = z.record(z.string(), z.unknown()).optional();

/** `db.seed(data)`: load rows into the tables and answer with how many were loaded. */
export const seedAction: ActionDefinition = defineAction({
  name: "seed",
  doc: "Load rows into the in-memory tables, grouped by table name.",
  params,
  // Optional, because the same rows arrive either way: `db.seed baseline`
  // passes them here and `db.seed { users: … }` passes them as options.
  args: [optionalArg("tables", t.ref("db.Tables"), "Rows to load, grouped by table name.")],
  result: t.number,
  run: (ctx, input) => ctx.port(DbClientPort).seed(readSeedData(input)),
});

/**
 * Read the tables from either call shape.
 *
 * `db.seed baseline` passes them positionally. Written inline, `db.seed { … }`
 * puts them in the options map instead, which is why the verb declares one.
 */
function readSeedData(input: ActionInput<unknown>): SeedData {
  const positional = input.args[0];
  if (positional && typeof positional === "object") return positional as SeedData;
  return (input.params ?? {}) as SeedData;
}
