/**
 * The `gql` plugin: `query`, `mutate` and `subscribe`, plus the
 * `noGraphqlErrors` matcher.
 *
 * All three verbs cross the `GqlClient` port and answer with the same
 * `{ data, errors }` envelope, so a flow reads one shape whatever it asked for.
 */

export * from "./clients/index.js";
export { gqlPlugin, gqlPlugin as default } from "./plugin.js";
export * from "./port/index.js";
