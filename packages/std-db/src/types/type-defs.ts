import { type TypeSpec, t } from "@venn-lang/types";

/**
 * The named types `@venn-lang/db` publishes to scripts, keyed by their bare name.
 *
 * Hand-mirrored from `port/db-client.types.ts` (`Row` and `TableMap`, which
 * `SeedData` and `DbSnapshot` both alias): the two must agree, so change them together.
 */
export const dbTypeDefs: Readonly<Record<string, TypeSpec>> = {
  /**
   * One row. Which columns it has is the query's business, not the plugin's, so
   * the type says only what is always true: names to values.
   */
  Row: t.map(t.dynamic),
  /** Rows grouped by table name. What `db.seed` takes and `db.snapshot` gives back. */
  Tables: t.map(t.list(t.ref("db.Row"))),
};
