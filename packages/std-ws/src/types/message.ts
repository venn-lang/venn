import { type ZodType, z } from "@venn-lang/sdk";

/**
 * Runtime validation for `ws.Message`, registered on the plugin.
 *
 * Pairs with `wsTypeDefs.Message`, which tells the checker the same shape: this
 * one guards a value, that one types an expression.
 */
export const messageSchema: ZodType = z.object({
  type: z.string().optional(),
  data: z.unknown().optional(),
});
