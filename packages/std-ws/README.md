# @venn-lang/ws

> The `ws` namespace: open a WebSocket, send, wait for a message, close.

Venn's grammar knows no verbs. `@venn-lang/ws` registers the `ws` namespace with the runtime, so
`ws.connect` resolves to an action and `ws.expect` hands back a typed message. The socket itself lives
behind the `WsClient` port, not in a handle the flow carries around, so a host swaps the whole
transport by binding a different implementation.

## Install

Nothing to install yet. The package is unpublished (version `0.0.0`) and ships inside
`@venn-lang/stdlib`, which the `venn` CLI and the language server both load. A `.vn` file declares it:

```ruby
import { ws } from "venn/ws"
```

## Usage

```ruby
module demo.stream

import { ws } from "venn/ws"

flow "Stock stream" {
  step "the socket accepts the subscription" {
    ws.connect "wss://example.test/stream" { auth: "token" }
    ws.send { type: "subscribe", data: { sku: "sku-42" } }
    ws.close
  }
}
```

## API

Everything below is exported from the package barrel.

| Export | What it is |
| --- | --- |
| `wsPlugin` (also the default export) | The `PluginDefinition`: namespace `ws`, `requires: ["net"]`. |
| `WsClientPort` | `Port<WsClient>`, id `venn.port.ws-client`, version 1, methods `connect`, `send`, `expect`, `close`. |
| `createFakeWsClient({ incoming })` | The double: preloaded messages in, sent messages recorded on `sent`. |
| `createRealWsClient()` | The real client. Out of scope for this build: every method throws `VN8090`. |
| `messageSchema` | The Zod schema behind the nominal `Message` type the plugin registers. |
| `wsTypeDefs` | What the plugin publishes to the checker, as `TypeSpec` data. |

Types: `WsClient`, `FakeWsClient`, `WsConnectArgs`, `WsExpectQuery`, `Message`.

## Verbs

| Verb | Shape | Result |
| --- | --- | --- |
| `ws.connect` | `ws.connect url { auth }` | nothing |
| `ws.send` | `ws.send { type, data }` | nothing |
| `ws.expect` | `ws.expect { type }` or `ws.expect { where }` | `ws.Message` |
| `ws.close` | `ws.close` | nothing |

Only `ws.connect` has a positional argument, the URL. For `ws.send` the message *is* the options map.
For `ws.expect` the query is: `type` matches the message type, `where` matches field by field, and the
first message that satisfies it is consumed and returned.

## Matchers and types

The plugin publishes one type, `ws.Message`: an open record with optional `type` and `data`. It is
open because `expect { where: … }` matches on whatever fields a message actually carries beyond those
two.

A matcher named `type` is registered against `Message`, but `type` is a grammar keyword, so it cannot
be spelled after `expect` today. Read the field instead:

```ruby
import { ws } from "venn/ws"

const msg = ws.expect { type: "ack" }
expect msg.type == "ack"
```

## Ports and conformance

`WsClient` has the two implementations every port has, and both run
`src/clients/ws-client.suite.ts`:

- `createRealWsClient()` is a stub in this build. Every method raises `VN8090`.
- `createFakeWsClient({ incoming })` resolves `expect` from a preloaded queue and records every
  `send` on `sent`, so a test asserts on what the flow put on the wire without a wire:

```ts
import { createFakeWsClient } from "@venn-lang/ws";

const client = createFakeWsClient({ incoming: [{ type: "ack", data: { ok: true } }] });
await client.connect({ url: "wss://example.test", auth: "token" });
await client.send({ type: "ping", data: 1 });
// client.sent === [{ type: "ping", data: 1 }]
```

`expect` prefers the matching message over the first one, and falls back to the first when nothing
matches. An empty queue raises `VN8091`.

That matters for `ws.expect` in a `.vn` file: `@venn-lang/stdlib` binds `createFakeWsClient({ incoming: [] })`
by default, so the verb has nothing to resolve and fails with `VN8091` until a host binds a client
seeded with messages.

## See also

- [`@venn-lang/mqtt`](../std-mqtt), the same shape over topics rather than a socket.
- [`@venn-lang/http`](../std-http), the reference plugin, with a real client and a real server.
- [`@venn-lang/stdlib`](../stdlib) for the plugin list and the default port bindings.
