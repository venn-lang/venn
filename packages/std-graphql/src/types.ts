import { type TypeSpec, t } from "@venn/types";

/**
 * The types the plugin publishes to flows: `gql.GraphqlResponse` and
 * `gql.GraphqlError`.
 *
 * They mirror `port/gql-client.types.ts` by hand, under the names the rest of
 * the plugin already answers to: `noGraphqlErrors` applies to `GraphqlResponse`,
 * so the type a flow reaches for is the same word.
 */
export const gqlTypeDefs: Readonly<Record<string, TypeSpec>> = {
  /**
   * The `{ data, errors }` envelope every gql verb gives back.
   *
   * Open, because a server may answer with more than the two entries the client
   * reads, `extensions` above all.
   */
  GraphqlResponse: t.record(
    { data: t.dynamic, errors: t.list(t.ref("gql.GraphqlError")) },
    { optional: ["data", "errors"], open: true },
  ),
  /** One entry of `errors`. `path` walks down `data` to the field that failed. */
  GraphqlError: t.record(
    {
      message: t.string,
      path: t.list(t.union(t.string, t.number)),
      extensions: t.map(t.dynamic),
    },
    { optional: ["path", "extensions"], open: true },
  ),
};
