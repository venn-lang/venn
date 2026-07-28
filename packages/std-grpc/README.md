# @venn-lang/grpc

> The `grpc` namespace: unary calls, server streams and server reflection as Venn verbs.

Three verbs over one port. The method name is the positional argument and the request message is the
options map, so a call reads the way a `.proto` does. This package never parses a `.proto` itself:
what a call returns is `dynamic`, and reflection is the only shape it can describe.

## Install

The package ships with the stdlib, so the CLI already loads it. Inside a `.vn` file, bring the
namespace in with `use`:

```ruby
use "venn/grpc"
```

## Usage

```ruby
module demo.inventory

use "venn/grpc"

flow "Inventory" {
  step "check the stock" {
    let res = grpc.call "Inventory/Check" { sku: "sku-42" }
    expect res.inStock == true
  }

  step "watch the prices" {
    let ticks = grpc.stream "Prices/Watch" { sku: "sku-42" }
    expect ticks.len > 0
  }
}
```

The request message is a free-form map, so no key is ever "unknown" and `VN3001` cannot fire here.
The trade is that nothing checks the field names either: they are the server's business.

## Verbs

| Verb | Positional argument | Options | Result |
| --- | --- | --- | --- |
| `grpc.call` | `method: string`, the full `package.Service/Method` | the request message | `dynamic` |
| `grpc.stream` | `method: string` | the request message | `list<dynamic>` |
| `grpc.reflect` | `service: string` | none | `list<grpc.MethodInfo>` |

`grpc.stream` hands back the messages already collected into a list. It is not a live stream, so a
flow reads it like any other list.

## Types

The plugin publishes one named type, the only thing it can honestly describe:

| Name | Shape |
| --- | --- |
| `grpc.MethodInfo` | `{ name: string, requestType: string, responseType: string, clientStreaming: bool, serverStreaming: bool }` |

A call's request and response come from a `.proto` nobody here has read, so they stay `dynamic`.

## The GrpcClient port

| | |
| --- | --- |
| id | `venn.port.grpc-client` |
| version | `1` |
| requires | `net` |
| methods | `call`, `stream`, `reflect` |

Two implementations ship with the package. `createFakeClient` replays canned messages keyed by
method; `createRealClient` is a placeholder that throws `VN8090` on every call, since proto loading,
channels and real reflection are out of scope for this build. The conformance suite lives in
`src/clients/grpc-client.suite.ts` and the fake runs it today; the real client joins it the day it
answers instead of throwing.

`@venn-lang/stdlib` binds `createFakeClient()` with no configuration, so out of the box `call` answers
`{}`, `stream` answers `[]` and `reflect` answers `[]`. To make the example above pass, bind a fake
of your own:

```ts
import { createFakeClient, GrpcClientPort } from "@venn-lang/grpc";

const binding = {
  port: GrpcClientPort,
  impl: createFakeClient({
    responses: { "Inventory/Check": { inStock: true, quantity: 42 } },
    streams: { "Prices/Watch": [{ price: 1 }, { price: 2 }] },
    reflection: {
      Inventory: [
        {
          name: "Check",
          requestType: "CheckRequest",
          responseType: "CheckResponse",
          clientStreaming: false,
          serverStreaming: false,
        },
      ],
    },
  }),
};
```

`responses` and `streams` are keyed by the full method; `reflection` is keyed by service name.

## API

| Export | What it is |
| --- | --- |
| `grpcPlugin` (also the default export) | The `PluginDefinition`: namespace `grpc`, `requires: ["net"]`, three actions. |
| `GrpcClientPort` | The port descriptor actions resolve through `ctx.port(...)`. |
| `createFakeClient({ responses?, streams?, reflection? })` | The test double. Unknown keys fall back to `{}` or `[]`. |
| `createRealClient()` | The real client's slot. Every method throws `VN8090`. |
| `GrpcCall`, `GrpcClient`, `GrpcMethodInfo` | Types only. |

## See also

- [`@venn-lang/graphql`](../std-graphql), the same port pattern over GraphQL.
- [`@venn-lang/http`](../std-http), the HTTP verbs and the `Response` type.
- [`@venn-lang/sdk`](../sdk), `defineAction` / `definePlugin`.
