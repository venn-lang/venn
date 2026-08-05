# @venn-lang/stdlib

> The one list of standard-library plugins, plus the fake port implementations the tooling runs them with.

The Venn kernel knows no verbs. Every namespace a `.vn` file can import comes from a plugin, and this
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

The flow being run is ordinary Venn source. It declares the namespaces it wants with `import`, and every
one of them resolves because the whole stdlib is loaded:

```ruby
module demo.stdlib

import { data } from "venn/data"
import { auth } from "venn/auth"
import { db } from "venn/db"

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
    db.seed ({ users: [{ id: 1 }, { id: 2 }] })
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

Twenty-four plugins, each contributing one namespace. Namespaces are unique across the list, so no
plugin can shadow another.

| Package | Namespace | Requires | What it contributes |
| --- | --- | --- | --- |
| [`@venn-lang/http`](../std-http) | `http` | `net` | Request verbs, response matchers and a nominal `Response` type. |
| [`@venn-lang/assert`](../std-assert) | `assert` | | Matchers only. `expect` is kernel; the words after it come from here. |
| [`@venn-lang/data`](../std-data) | `data` | `random` | Deterministic test-data generators, every one drawing from the run's own source. |
| [`@venn-lang/crypto`](../std-crypto) | `crypto` | `random` | Digests, encodings, password hashing and JSON Web Tokens. |
| [`@venn-lang/env`](../std-env) | `env` | | The name only. `env.NAME` is a read, filled from the `[env.*]` tables of `venn.toml`. |
| [`@venn-lang/date`](../std-date) | `date` | `clock` | Moments, durations and the arithmetic between them. `date.now` reads the host clock. |
| [`@venn-lang/fmt`](../std-fmt) | `fmt` | | Value to text: JSON, tables, YAML, CSV, XML. Pure. |
| [`@venn-lang/json`](../std-json) | `json` | | Text to value and back, and the questions worth asking of one. Pure. |
| [`@venn-lang/path`](../std-path) | `path` | | Joining a path, taking one apart, and asking where it leads. Pure. |
| [`@venn-lang/fs`](../std-fs) | `fs` | `fs` | Reading a file whole, writing one whole, and what a directory holds. |
| [`@venn-lang/math`](../std-math) | `math` | `random` | Arithmetic, rounding and statistics over a list, plus `math.random` and `math.randomInt`. |
| [`@venn-lang/io`](../std-io) | `io` | `io` | A script's standard input, output and arguments. |
| [`@venn-lang/mock`](../std-mock) | `mock` | | In-process mocking, feature flags and a virtual clock. Keeps state between calls. |
| [`@venn-lang/auth`](../std-auth) | `auth` | `net`, `random` | Token and header builders, plus an OAuth2 client port. |
| [`@venn-lang/notify`](../std-notify) | `notify` | `net` | Notification dispatch through the Notifier port. |
| [`@venn-lang/ws`](../std-ws) | `ws` | `net` | Connect, send, expect and close over a WebSocket. |
| [`@venn-lang/mqtt`](../std-mqtt) | `mqtt` | `net` | Connect, publish, subscribe and expect over MQTT. |
| [`@venn-lang/graphql`](../std-graphql) | `gql` | `net` | Query, mutate and subscribe, with matchers on the response. |
| [`@venn-lang/grpc`](../std-grpc) | `grpc` | `net` | Call, stream and reflect. |
| [`@venn-lang/mail`](../std-mail) | `mail` | `net` | Inbox verbs over the MailClient port. |
| [`@venn-lang/db`](../std-db) | `db` | `net` | Table verbs over the DbClient port. |
| [`@venn-lang/browser`](../std-browser) | `browser` | `net` | Actions, matchers and the browser types. |
| [`@venn-lang/load`](../std-load) | `load` | `net` | Load-profile builders and a runner that yields metrics. |
| [`@venn-lang/artifacts`](../std-artifacts) | `artifacts` | `fs` | Store references to traces, videos, HARs and screenshots. |

`requires` is negotiated against the host's capabilities before anything runs. A host that does not
offer `net` fails to load `@venn-lang/http` with a readable diagnostic, not with a `TypeError` halfway
through a test.

**It is also what decides whether a `fn` may call a verb.** A `fn` is pure, and the checker reads this
column to know what "pure" means: a namespace with an empty cell may be called from a `fn`, and one
with a capability may not. So `fn portOf(text) => try json.parse(text).port else 8080` compiles, while
the same body reaching `date.now` or `math.randomInt` is refused with `VN2024`. Every verb of `assert`,
`env`, `fmt`, `json`, `path` and `mock` is callable that way.

Because one column answers two questions, an empty cell is load-bearing twice over, and four of them
were wrong until recently: `math`, `date`, `crypto` and `auth` each reached a port whose capability
they did not declare. That is not only a purity hole. It also broke the promise above, since on a host
without `random` those plugins loaded clean and then died at port bind partway through a run.

**A capability belongs to a plugin and purity belongs to a verb**, so a single verb may say it does not
use what its namespace asked for, with `pure: true` on the action. `date.format` is handed the moment it
writes and `math.isClose` compares two numbers you already have, and both are callable from a `fn`
though `date.now` and `math.randomInt` beside them are not. That is the exception and not the rule:
leaving it out inherits the plugin's answer, which is what keeps an author who says nothing from
accidentally getting permission to do I/O inside something the language calls pure. Without it a
namespace with no pure path forces working code to be rewritten into `fragment`s to satisfy a rule
about effects it does not have, which is what `examples/programs/standup/rota/schedule.vn` would have
cost.

`mock` is the case neither mechanism reaches: its verbs ask for no port, so nothing is declared, and yet
they keep state in a module-level store, so `mock.flag("x")` answers differently depending on what ran
before it. `requires` cannot express state and `atFlowStart` is the field that could and is declared by
nobody.

Four tests in this package hold the list to its word. Two check that every plugin has a name and a
unique namespace, that every verb carries a signature, and that every type reference points at
something a plugin actually publishes, since a dangling reference would otherwise degrade to `dynamic`
in silence and the editor would simply forget what it knew. The other two drive every verb of every
plugin with a context that records the ports it asks for:
`a-plugin-declares-what-it-reaches.test.ts` fails a plugin that reaches a capability its cell omits, and
`a-verb-may-claim-purity.test.ts` fails a verb that claims `pure` while asking for a port. A plugin
holds opaque closures, so driving them is the only way to check either claim rather than trust it. Both
were promises before those files existed, and one of them was already false in four places.

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

Crypto binds the real Web Crypto engine rather than a fake, and always did, because a digest is a
computation over its input rather than a call out to anything. That much is still true. What used to be
written here, and on the port and the plugin beside it, was the stronger claim that crypto is therefore
pure and needs no capability, and that claim was wrong: `CryptoEnginePort` also publishes `randomBytes`,
which `crypto.uuid` and `crypto.password.hash` draw from. Whether the code to do it exists on every
target is not what a capability asks. So the port and the plugin both declare `random` now, and
`crypto` is refused inside a `fn`, digests included, because a port binds as a whole.

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

That is exactly what the CLI does. `venn test` and `venn run` bind a real HTTP client, a real Node
server and the real streams behind `ConsolePort`, and leave every other port on its fake, which is
why the stdlib example above runs offline.

There is no console in `stdlibPortBindings`. A host that prints has to say where to, and one that
forgets hears `VN7002` rather than writing into a buffer nobody reads.

## See also

- [`@venn-lang/runtime`](../runtime) executes a document against these plugins and ports.
- [`@venn-lang/sdk`](../sdk) is how each of these plugins is defined, and how a third-party one is.
- [`@venn-lang/cli`](../cli) assembles the Node host and picks the real implementations.
