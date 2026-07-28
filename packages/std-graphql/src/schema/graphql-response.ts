import { type ZodType, z } from "@venn/sdk";

/**
 * Runtime validation for `gql.GraphqlResponse`, registered on the plugin.
 *
 * Pairs with `gqlTypeDefs.GraphqlResponse`, which tells the checker the same
 * shape: this one guards a value, that one types an expression.
 */
export const graphqlResponseType: ZodType = z.object({
  data: z.unknown().optional(),
  errors: z.array(z.unknown()).optional(),
});
