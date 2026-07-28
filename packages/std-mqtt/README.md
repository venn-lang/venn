# @venn-lang/mqtt

> The `mqtt` namespace: connect to a broker, publish, subscribe, wait for a message on a topic.

Venn's grammar knows no verbs. `@venn-lang/mqtt` registers the `mqtt` namespace with the runtime, so
`mqtt.publish` resolves to an action and `mqtt.expect` hands back a typed message. The connection and
the subscriptions live behind the `MqttClient` port, not in a handle the flow carries around, so a
host swaps the whole transport by binding a different implementation.

## Install

Nothing to install yet. The package is unpublished (version `0.0.0`) and ships inside
`@venn-lang/stdlib`, which the `venn` CLI and the language server both load. A `.vn` file declares it:

```ruby
use "venn/mqtt"
```

## Usage

```ruby
module demo.inventory

use "venn/mqtt"
use "venn/assert"

flow "Inventory" {
  step "the broker relays the stock change" {
    mqtt.connect "mqtt://broker.test:1883"
    mqtt.subscribe "inventory/sku-42"
    mqtt.publish "inventory/sku-42" { json: { delta: -1 }, qos: 1 }

    const msg = mqtt.expect "inventory/sku-42"
    expect msg topic "inventory/sku-42"
    expect msg.payload.delta == -1
  }
}
```

## API

Everything below is exported from the package barrel.

| Export | What it is |
| --- | --- |
| `mqttPlugin` (also the default export) | The `PluginDefinition`: namespace `mqtt`, `requires: ["net"]`. |
| `MqttClientPort` | `Port<MqttClient>`, id `venn.port.mqtt-client`, version 1, methods `connect`, `publish`, `subscribe`, `expect`. |
| `createFakeMqttClient({ seed })` | The double: a topic-to-queue map that records publishes and subscriptions. |
| `createRealMqttClient()` | The real client. Out of scope for this build: every method throws `VN8090`. |
| `messageSchema` | The Zod schema behind the nominal `Message` type the plugin registers. |
| `mqttTypeDefs` | What the plugin publishes to the checker, as `TypeSpec` data. |

Types: `MqttClient`, `FakeMqttClient`, `MqttPublishArgs`, `MqttMessage`.

## Verbs

| Verb | Shape | Result |
| --- | --- | --- |
| `mqtt.connect` | `mqtt.connect broker` | nothing |
| `mqtt.publish` | `mqtt.publish topic { json, qos, retain, will }` | nothing |
| `mqtt.subscribe` | `mqtt.subscribe topic` | nothing |
| `mqtt.expect` | `mqtt.expect topic` | `mqtt.Message` |

Each verb takes one positional argument: the broker URL for `connect`, the topic (wildcards and all)
for the other three. Only `publish` has an options map, and it carries `json` (the payload), `qos`,
`retain` and `will`.

`subscribe` hands nothing back: the subscription is the port's to remember, and `mqtt.expect` is how a
flow reaches what arrived.

## Matchers and types

`topic` is the one matcher: `expect msg topic "inventory/ack"` passes when the message arrived on that
topic.

The plugin publishes one type, `mqtt.Message`, with `topic`, `payload`, and optional `qos` and
`retain`. It is what `mqtt.expect` hands back, and what tells the checker that `msg` can carry the
`topic` matcher.

## Ports and conformance

`MqttClient` has the two implementations every port has, and both run
`src/clients/mqtt-client.suite.ts`:

- `createRealMqttClient()` is a stub in this build. Every method raises `VN8090`.
- `createFakeMqttClient({ seed })` keeps one queue per topic. A publish is recorded on `published`
  (with its `qos`, `retain` and `will`) and enqueued, so a publish-then-expect flow resolves without a
  broker. Subscriptions land on `subscriptions`.

```ts
import { createFakeMqttClient } from "@venn-lang/mqtt";

const client = createFakeMqttClient();
await client.subscribe({ topic: "inventory/ack" });
await client.publish({ topic: "inventory/ack", payload: { ok: true }, qos: 1 });
const message = await client.expect({ topic: "inventory/ack" });
// message.payload === { ok: true }
```

`expect` on an empty topic raises `VN8091`. `@venn-lang/stdlib` binds the fake by default, so the flow in
[Usage](#usage) runs offline with no host wiring at all.

## See also

- [`@venn-lang/ws`](../std-ws), the same shape over a socket rather than topics.
- [`@venn-lang/http`](../std-http), the reference plugin, with a real client and a real server.
- [`@venn-lang/stdlib`](../stdlib) for the plugin list and the default port bindings.
