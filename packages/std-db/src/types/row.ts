import { type ZodType, z } from "@venn/sdk";

/** The nominal `Row` type: an opaque record of column values. */
export type Row = Record<string, unknown>;

/** Zod schema for the nominal `Row` type the plugin contributes. */
export const RowSchema: ZodType<Row> = z.record(z.string(), z.unknown());
