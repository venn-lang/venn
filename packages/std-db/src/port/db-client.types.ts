import type { Row } from "../types/index.js";

/** Arguments for {@link DbClient.query}: a SQL string plus an optional filter. */
export interface QueryArgs {
  sql: string;
  where?: Row;
}

/** Arguments for {@link DbClient.exec}: a mutating statement plus optional rows. */
export interface ExecArgs {
  sql: string;
  rows?: Row[];
}

/** Rows keyed by table name. The shape seeds and snapshots share. */
export type TableMap = Record<string, Row[]>;

/** Rows to load, keyed by table name. */
export type SeedData = TableMap;

/** A captured copy of every table. Detached from live state, so it can be restored later. */
export type DbSnapshot = TableMap;

/**
 * The contract a database is reached through. Actions call it via
 * `ctx.port(DbClientPort)` and never touch a driver directly.
 */
export interface DbClient {
  connect(url: string): Promise<void>;
  query(args: QueryArgs): Promise<Row[]>;
  exec(args: ExecArgs): Promise<number>;
  seed(data: SeedData): Promise<number>;
  snapshot(): Promise<DbSnapshot>;
  restore(snapshot: DbSnapshot): Promise<void>;
}
