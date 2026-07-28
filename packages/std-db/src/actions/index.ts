import type { ActionDefinition } from "@venn/sdk";
import { connectAction } from "./connect.js";
import { execAction } from "./exec.js";
import { queryAction } from "./query.js";
import { restoreAction } from "./restore.js";
import { seedAction } from "./seed.js";
import { snapshotAction } from "./snapshot.js";

/** The db namespace's verbs. Adding one is a single line here. */
export const dbActions: ActionDefinition[] = [
  connectAction,
  queryAction,
  execAction,
  seedAction,
  snapshotAction,
  restoreAction,
];
