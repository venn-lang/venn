import { type ActionDefinition, arg, defineAction } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { DbClientPort } from "../port/index.js";

/** `db.connect(url)`: open the connection the other `db` verbs then use. */
export const connectAction: ActionDefinition = defineAction({
  name: "connect",
  doc: "Connect to a database by URL.",
  // It answers with the URL, not a handle: the connection lives behind the port,
  // and every other verb reaches it from there.
  args: [arg("url", t.string, "Where the database is.")],
  result: t.string,
  run: async (ctx, input) => {
    const url = String(input.args[0] ?? "");
    await ctx.port(DbClientPort).connect(url);
    return url;
  },
});
