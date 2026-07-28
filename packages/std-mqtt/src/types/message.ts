import { type ZodType, z } from "@venn-lang/sdk";

/**
 * Runtime validation for `mqtt.Message`, registered on the plugin.
 *
 * Pairs with `mqttTypeDefs.Message`, which tells the checker the same shape:
 * this one guards a value, that one types an expression.
 */
export const messageSchema: ZodType = z.object({
  topic: z.string(),
  payload: z.unknown(),
  qos: z.number().optional(),
  retain: z.boolean().optional(),
});
