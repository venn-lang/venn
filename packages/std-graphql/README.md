# @venn/graphql

> The `gql` namespace: GraphQL queries, mutations and subscriptions as Venn verbs.

Three verbs that all answer with the same `{ data, errors }` envelope, plus a `noGraphqlErrors`
matcher to assert on it. Every call travels through the `GqlClient` port, so the same `.vn` file runs
against a live server or against canned responses depending only on what the host bound at startup.

## Install

The package ships with the stdlib, so the CLI already loads it. Inside a `.vn` file, bring the
namespace in with `use`:

```ruby
use "@venn/graphql"
```

## Usage

```ruby
module demo.profile

use "@venn/graphql"

flow "Profile" {
  step "read the profile" {
    let res = gql.query "{ me { id plan } }" { auth: "Bearer tok123" }
    expect res noGraphqlErrors
    expect res.data.me.plan == "pro"
  }
}
```

The document is the single positional argument. Everything else rides the options map:

```ruby
let res = gql.mutate "mutation Rename($id: ID!, $name: String!) { rename(id: $id, name: $name) { id } }" {
  variables: { id: "u1", name: "Alice" }
  auth: "Bearer tok123"
}
```

`variables` and `auth` are the only accepted option names. Anything else is `VN3001`, reported by
`venn check` before the flow runs and refused again when the line executes.

## Verbs

| Verb | Positional argument | Options | Result |
| --- | --- | --- | --- |
| `gql.query` | `document: string` | `variables`, `auth` | `gql.GraphqlResponse` |
| `gql.mutate` | `document: string` | `variables`, `auth` | `gql.GraphqlResponse` |
| `gql.subscribe` | `document: string` | `variables`, `auth` | `gql.GraphqlResponse` |

`query` and `mutate` both call `GqlClient.execute`; `subscribe` calls `GqlClient.subscribe`. A
subscription answers with one envelope, the same shape as the other two, not a live stream.

## Matcher

`expect <subject> noGraphqlErrors` passes when `errors` is absent, `null`, or an empty array, and
fails when it carries at least one entry. It declares `appliesTo: "GraphqlResponse"`, which the
editor shows on hover. The matcher lives in the plugin definition (`gqlPlugin.matchers`) and is not
exported from the barrel.

## Types

The plugin publishes two named types the checker and the editor read:

| Name | Shape |
| --- | --- |
| `gql.GraphqlResponse` | `{ data?: dynamic, errors?: list<gql.GraphqlError> }`, open |
| `gql.GraphqlError` | `{ message: string, path?: list<string \| number>, extensions?: map<dynamic> }`, open |

Both are open, because a server may answer with more than the client reads (`extensions`, above all).

## The GqlClient port

| | |
| --- | --- |
| id | `venn.port.gql-client` |
| version | `1` |
| requires | `net` |
| methods | `execute`, `subscribe` |

Two implementations ship with the package, as the port rule demands. `createFakeClient` replays
canned envelopes; `createRealClient` is a placeholder that throws `VN8090` on every call, since no
real transport is wired in this build. The conformance suite lives in
`src/clients/gql-client.suite.ts` and the fake runs it today; the real client joins it the day it
answers instead of throwing.

`@venn/stdlib` binds `createFakeClient()` with no configuration, so out of the box every call answers
`{ data: {}, errors: undefined }`: `noGraphqlErrors` passes and field assertions have nothing to read.
To assert on real data, bind a fake of your own:

```ts
import { createFakeClient, GqlClientPort, okGraphqlResponse } from "@venn/graphql";

const binding = {
  port: GqlClientPort,
  impl: createFakeClient({
    responses: {
      "{ me { id plan } }": okGraphqlResponse({ data: { me: { id: "u1", plan: "pro" } } }),
    },
  }),
};
```

`responses` is keyed by the exact document text; `response` sets a single fallback for every query.

## API

| Export | What it is |
| --- | --- |
| `gqlPlugin` (also the default export) | The `PluginDefinition`: namespace `gql`, `requires: ["net"]`, three actions, one matcher. |
| `GqlClientPort` | The port descriptor actions resolve through `ctx.port(...)`. |
| `createFakeClient({ response?, responses? })` | The test double. Returns the canned envelope for a query, or the fallback. |
| `okGraphqlResponse(overrides?)` | `{ data: {}, errors: undefined }` merged with `overrides`. |
| `createRealClient()` | The real client's slot. Every method throws `VN8090`. |
| `graphqlResponseType` | The Zod schema of the envelope, registered as the plugin's `GraphqlResponse` type. |
| `GqlClient`, `GqlRequest`, `GqlResponse`, `GqlError` | Types only. |

## See also

- [`@venn/grpc`](../std-grpc), the same port pattern over gRPC.
- [`@venn/http`](../std-http), the HTTP verbs and the `Response` type.
- [`@venn/sdk`](../sdk), `defineAction` / `defineMatcher` / `definePlugin`.
