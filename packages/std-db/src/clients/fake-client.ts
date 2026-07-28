import type { DbClient, DbSnapshot, SeedData, TableMap } from "../port/index.js";
import { cloneTables, execStatement, seedTables, selectRows } from "./query-engine.js";

interface DbState {
  tables: TableMap;
}

/**
 * The in-memory `DbClient`: deterministic tables, no connection, no I/O.
 *
 * @param args.tables Rows to start from. Copied, so the caller's object is never mutated.
 */
export function createFakeDbClient(args: { tables?: SeedData } = {}): DbClient {
  const state: DbState = { tables: cloneTables(args.tables ?? {}) };
  return {
    connect: () => Promise.resolve(),
    query: (query) => Promise.resolve(selectRows(state.tables, query)),
    exec: (statement) => Promise.resolve(execStatement(state.tables, statement)),
    seed: (data) => Promise.resolve(seedTables(state.tables, data)),
    snapshot: () => Promise.resolve(cloneTables(state.tables)),
    restore: (snapshot) => restore(state, snapshot),
  };
}

function restore(state: DbState, snapshot: DbSnapshot): Promise<void> {
  state.tables = cloneTables(snapshot);
  return Promise.resolve();
}
