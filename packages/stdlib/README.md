# @venn-lang/stdlib

> The one list of standard-library plugins, plus the fake port implementations the tooling runs them with.

The Venn kernel knows no verbs. Every namespace a `.vn` file can `use` comes from a plugin, and this
package is where the set of them is named. The CLI runs that list, and the language server reads it
for completion, hover, highlighting and `venn check`. Adding a plugin to the standard library touches
this package and nothing else.

## Usage

```ts
import { createNodeHost } from "@venn-lang/contracts/node";
import { parse } from "@venn-lang/core";
import { createMemorySink, createRunner } from "@venn-lang/runtime";
import { allPlugins, stdlibPortBindings } from "@venn-lang/stdlib";

const { ast, problems } = parse(source, { uri: "flow.vn" });
if (problems.length > 0) {
  throw new Error(problems.map((one) => `${one.code} ${one.title}`).join("\n"));
}

const runner = createRunner({
  host: createNodeHost(),
  plugins: allPlugins,
  sink: createMemorySink(),
  ports: stdlibPortBindings,
});

const result = await runner.run(ast);
```

The flow being run is ordinary Venn source. It declares the namespaces it wants with `use`, and every
one of them resolves because the whole stdlib is loaded:

```ruby
module demo.stdlib

import { data } from "venn/data"
import { auth } from "venn/auth"
import { db } from "venn/db"
import { assert } from "venn/assert"

flow "Stdlib showcase" {
  step "auth builds a bearer header" {
    const header = auth.bearer "tok123"
    expect header.Authorization == "Bearer tok123"
  }

  step "deterministic fake data" {
    const roll = data.range 1 10
    expect roll >= 1
  }

  step "in-memory database" {
    db.seed { users: [{ id: 1 }, { id: 2 }] }
    const rows = db.query "SELECT * FROM users"
    expect rows.len == 2
  }
}
```

## API

| Export | Type | What it is |
| --- | --- | --- |
| `allPlugins` | `PluginDefinition[]` | Every stdlib plugin, in load order. Hand it to `createRunner`, `buildRegistry` or `createTypeCatalog`. |
| `stdlibPortBindings` | `PortBinding[]` | One implementation per stdlib port, fake where a real one would touch the network. Hand it to `createRunner` as `ports`. |

## The plugins

Nineteen plugins, each contributing one namespace. Namespaces are unique across the list, so no
plugin can shadow another.

| Package | Namespace | Requires | What it contributes |
| --- | --- | --- | --- |
| [`@venn-lang/http`](../std-http) | `http` | `net` | Request verbs, response matchers and a nominal `Response` type. |
| [`@venn-lang/assert`](../std-assert) | `assert` | | Matchers only. `expect` is kernel; the words after it come from here. |
| [`@venn-lang/data`](../std-data) | `data` | | Deterministic test-data generators. Pure, no port. |
| [`@venn-lang/crypto`](../std-crypto) | `crypto` | | Digests, encodings, password hashing and JSON Web Tokens. |
| [`@venn-lang/env`](../std-env) | `env` | | The name only. `env.NAME` is a read, filled from the `[env.*]` tables of `venn.toml`. |
| [`@venn-lang/fmt`](../std-fmt) | `fmt` | | Value to text: JSON, tables, YAML, CSV, XML. Pure. |
| [`@venn-lang/io`](../std-io) | `io` | `io` | A script's standard input, output and arguments. |
| [`@venn-lang/mock`](../std-mock) | `mock` | | In-process mocking, feature flags and a virtual clock. |
| [`@venn-lang/auth`](../std-auth) | `auth` | `net` | Token and header builders, plus an OAuth2 client port. |
| [`@venn-lang/notify`](../std-notify) | `notify` | `net` | Notification dispatch through the Notifier port. |
| [`@venn-lang/ws`](../std-ws) | `ws` | `net` | Connect, send, expect and close over a WebSocket. |
| [`@venn-lang/mqtt`](../std-mqtt) | `mqtt` | `net` | Connect, publish, subscribe and expect over MQTT. |
| [`@venn-lang/graphql`](../std-graphql) | `gql` | `net` | Query, mutate and subscribe, with matchers on the response. |
| [`@venn-lang/grpc`](../std-grpc) | `grpc` | `net` | Call, stream and reflect. |
| [`@venn-lang/mail`](../std-mail) | `mail` | `net` | Inbox verbs over the MailClient port. |
| [`@venn-lang/db`](../std-db) | `db` | `net` | Table verbs over the DbClient port. |
| [`@venn-lang/browser`](../std-browser) | `browser` | `net` | Actions, matchers and a browser resource. |
| [`@venn-lang/load`](../std-load) | `load` | `net` | Load-profile builders and a runner that yields metrics. |
| [`@venn-lang/artifacts`](../std-artifacts) | `artifacts` | `fs` | Store references to traces, videos, HARs and screenshots. |

`requires` is negotiated against the host's capabilities before anything runs. A host that does not
offer `net` fails to load `@venn-lang/http` with a readable diagnostic, not with a `TypeError` halfway
through a test.

Two tests in this package hold the list to its word: every plugin has a name and a unique namespace,
every verb carries a signature, and every type reference points at something a plugin actually
publishes. A dangling reference would otherwise degrade to `dynamic` in silence and the editor would
simply forget what it knew.

## The port bindings

`stdlibPortBindings` binds each port once. Real third-party integrations are out of scope for this
repository, so most implementations are the test double that ships alongside the port.

| Port | Implementation | From |
| --- | --- | --- |
| `AuthClientPort` | `createFakeAuthClient()` | [`@venn-lang/auth`](../std-auth) |
| `HttpServerPort` | `createMemoryServer()` | [`@venn-lang/http`](../std-http) |
| `CryptoEnginePort` | `createWebCryptoEngine()` | [`@venn-lang/crypto`](../std-crypto) |
| `NotifierPort` | `createFakeNotifier()` | [`@venn-lang/notify`](../std-notify) |
| `WsClientPort` | `createFakeWsClient({ incoming: [] })` | [`@venn-lang/ws`](../std-ws) |
| `MqttClientPort` | `createFakeMqttClient()` | [`@venn-lang/mqtt`](../std-mqtt) |
| `GqlClientPort` | `createFakeGqlClient()` | [`@venn-lang/graphql`](../std-graphql) |
| `GrpcClientPort` | `createFakeGrpcClient()` | [`@venn-lang/grpc`](../std-grpc) |
| `MailClientPort` | `createFakeMailClient()` | [`@venn-lang/mail`](../std-mail) |
| `DbClientPort` | `createFakeDbClient()` | [`@venn-lang/db`](../std-db) |
| `BrowserDriverPort` | `createFakeBrowserDriver()` | [`@venn-lang/browser`](../std-browser) |
| `PreviewProviderPort` | `createNonePreviewProvider()` | [`@venn-lang/browser`](../std-browser) |
| `LoadRunnerPort` | `createFakeLoadRunner()` | [`@venn-lang/load`](../std-load) |
| `ArtifactStorePort` | `createMemoryArtifactStore()` | [`@venn-lang/artifacts`](../std-artifacts) |
| `ConsolePort` | `createMemoryConsole()` | [`@venn-lang/contracts`](../contracts) |

Crypto is the exception: it is pure computation rather than a side effect, so the real Web Crypto
engine is bound and always was.

`HttpClientPort` is deliberately absent. The one plugin with a real client leaves the choice to the
host, so a test can inject a fake and the CLI can inject `fetch`.

### Overriding a binding

Bindings are resolved by port id and the last one wins, so a host appends its own after the stdlib's:

```ts
const ports = [
  { port: HttpClientPort, impl: createFetchClient() },
  ...stdlibPortBindings,
  { port: HttpServerPort, impl: createNodeServer() },
];
```

That is exactly what the CLI does. `venn test` runs with a real HTTP client, a real Node server and a
real console, and every other port on its fake, which is why the stdlib example above runs offline.

## See also

- [`@venn-lang/runtime`](../runtime) executes a document against these plugins and ports.
- [`@venn-lang/sdk`](../sdk) is how each of these plugins is defined, and how a third-party one is.
- [`@venn-lang/cli`](../cli) assembles the Node host and picks the real implementations.
