import { type TypeSpec, t } from "@venn/types";

/**
 * The named types `@venn/data` publishes to scripts, keyed by their bare name.
 *
 * Hand-mirrored from `csv/csv.types.ts`: the two must agree, so change them together.
 */
export const dataTypeDefs: Readonly<Record<string, TypeSpec>> = {
  /**
   * One parsed CSV record. The keys come from the file's header line, so they
   * cannot be named here. Only the cell type is knowable, and it is always a string.
   */
  Row: t.map(t.string),
};
