# @venn-lang/sdk

> The plugin authoring API: small typed builders that return plain definition objects.

The Venn kernel knows no protocols. Every verb a `.vn` file can call (`http.get`, `crypto.hash`,
`db.query`) arrives from a plugin, and a plugin is just an object built with the functions here.
One definition feeds the runtime, the language server and the node graph at once, so a verb
describes itself in exactly one place.

The package depends on `@venn-lang/contracts` (types only), `@venn-lang/types` and `zod`. It never imports
`node:*`: a plugin has to load in a Web Worker like everything else, so its I/O goes through a port.

## Install

Nothing is published to npm yet. Inside this workspace:

```json
{ "dependencies": { "@venn-lang/sdk": "workspace:*", "@venn-lang/types": "workspace:*" } }
```

## Usage

A complete plugin: one namespace, one verb, one matcher.

```ts
// src/plugin.ts
import { HttpClientPort } from "@venn-lang/http";
import { arg, defineAction, defineMatcher, definePlugin, type PluginDefinition, z } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";

interface Probe {
  url: string;
  up: boolean;
  ms: number;
}

const probeParams = z.object({
  status: z.number().default(200).describe("Which status counts as up."),
});

export const uptimePlugin: PluginDefinition = definePlugin({
  name: "@acme/uptime",
  namespace: "uptime",
  requires: ["net"],
  typeDefs: { Probe: t.record({ url: t.string, up: t.bool, ms: t.number }) },
  actions: [
    defineAction({
      name: "probe",
      doc: "Ask a URL whether it is alive.",
      args: [arg("url", t.string, "Where to knock.")],
      params: probeParams,
      result: t.ref("uptime.Probe"),
      run: async (ctx, input): Promise<Probe> => {
        const url = String(input.args[0]);
        const client = ctx.port(HttpClientPort);
        const res = await client.request({ method: "GET", url, signal: ctx.signal });
        return { url, up: res.status === input.params.status, ms: res.time };
      },
    }),
  ],
  matchers: [
    defineMatcher({
      name: "up",
      appliesTo: "Probe",
      test: ({ subject }) => (subject as Probe).up,
      message: ({ subject }) => `expected ${(subject as Probe).url} to answer`,
      detail: ({ subject }) => ({ expected: true, actual: (subject as Probe).up }),
    }),
  ],
});

export default uptimePlugin;
```

The namespace, the verb and the matcher are then ordinary Venn:

<!-- venn-check: `@acme/uptime` is the plugin this page is teaching you to write -->

```ruby
import { uptime } from "@acme/uptime"

flow "the API answers" {
  step "probe the health endpoint" {
    const probe = uptime.probe "https://api.example.com/health" { status: 204 }
    expect probe up
  }
}
```

`venn verify-plugin <path>` loads a built module (its default export, or the first export that
looks like a plugin) and prints the namespace with the counts of actions and matchers.

## API

| Export | What it does |
| --- | --- |
| `definePlugin(def)` | Returns the `PluginDefinition` unchanged. This is the shape the registry ingests. |
| `defineAction(def)` | One verb. Derives `signature` from `args` and `result` when you do not write one. |
| `defineMatcher(def)` | One word usable after `expect`, with its own failure message and diff. |
| `defineDecorator(def)` | One `@name`, applied to the program's tree before anything reads it. |
| `Duration` | A `ZodType<number>`: reads the language's `30s`, the text `"30s"`, or `1500`, yields milliseconds. |
| `arg`, `optionalArg`, `restArg` | Build an `ArgSpec`, one named positional argument. |
| `signatureOf(args, result)` | The `FnSpec` those arguments describe. `defineAction` calls it for you. |
| `paramSpecs(schema)`, `paramNames(schema)` | Read a Zod options schema into `ParamSpec[]` (or just the key names). |
| `paramSchema(schema, key)` | The schema declared for one key, so a checker holds a value to what the run will hold it to. |
| `isUnitLiteral(value)`, `unitBase(value, kind)` | Tell one of the language's literals (`30s`, `2mb`, `50%`, a moment) from an ordinary map, and read the number inside it. |
| `z`, `ZodType` | Zod 4, re-exported so a plugin depends on `@venn-lang/sdk` alone. |
| `toBytes`, `fromBytes`, `toHex`, `fromHex`, `toBase64`, `fromBase64`, `toBase64Url`, `fromBase64Url`, `equals` | The byte encoders. See [Bytes](#bytes). |
| `CryptoEnginePort`, `createWebCryptoEngine`, `createFakeCryptoEngine` | The digest primitives two plugins share. See [The CryptoEngine port](#the-cryptoengine-port). |
| `HASH_ALGORITHMS`, `hashAlgorithm(written)`, `JWS_ALGORITHMS`, `JWS_HASH`, `jwsHash(alg)` | Which digests exist, and which one a name or a JWS `alg` header names. |

Types are exported alongside: `PluginDefinition`, `ActionDefinition`, `MatcherDefinition`,
`MatcherDetail`, `DecoratorDefinition`, `DecoratedNode`,
`ExpandContext`, `ActionContext`, `ActionInput`, `MatcherArgs`, `MatcherContext`, `ArgSpec`,
`ParamSpec`, `Bytes`, `CryptoEngine`, `DeriveArgs`, `HashAlgorithm`, `JwsAlgorithm`, `Signable`.

## The plugin object

| Field | Meaning |
| --- | --- |
| `name` | The package identity, and what a file writes in `import { … } from "…"`. |
| `namespace` | The prefix every verb gets: `namespace` `uptime` plus action `probe` is `uptime.probe`. |
| `requires` | Host capabilities: `fs`, `process`, `net`, `clock`, `random`, `secrets`, `log`, `io`. |
| `actions`, `matchers`, `decorators` | The contributions. All optional. |
| `values` | The constants the namespace publishes, read without brackets: `math.pi`. |
| `typeDefs` | The nominal data shapes the plugin publishes, as `TypeSpec` data, by short name. `Probe` is reachable from a flow as `uptime.Probe`, and this is what the checker and the editor read. |

Capabilities are negotiated when the registry is built, before a single line runs. A plugin that
requires `net` on a host that does not offer it fails with `VN2010` naming the plugin and the
missing capability, never with a `TypeError` halfway through a test.

`requires` is per plugin, which is the right grain for a host and too coarse for a verb. A single
verb that does not use what its namespace asked for says so with `pure: true`; see
[Actions](#actions).

A plugin with no verbs at all is legitimate. `@venn-lang/env` contributes only its namespace, so that a
file reading configuration still has to declare `import { env } from "venn/env"`.

## Actions

`defineAction` splits what a call site carries in two.

- `args` are the **positional** arguments, named and in order. The name is the point: a type alone
  tells the editor that a verb wants two values, never which. `restArg` says this argument and
  every one after it, `optionalArg` says the call still means something without it.
- `params` is a Zod schema for the **trailing options map**, `{ status: 204 }`. Describe a key with
  `.describe()` and the editor shows that text; there is no second list to drift.

`result` is what the call evaluates to. Between them, `args` and `result` produce the `signature`
the checker reads, via `signatureOf`. Pass `signature` yourself for a shape `args` cannot describe,
and it wins. Write neither and the call stays `dynamic`: a plugin that says nothing about types is
still a working plugin.

`pure` says this verb reaches nothing, which is a claim about the verb rather than about its
plugin: `date.now` reads the clock while `date.format` writes out a moment it was handed, from the
same namespace, and `requires` cannot tell the two apart. `true` is the only value, because "not
pure" has one spelling and that is leaving the field out; absent means the verb inherits its
plugin's capabilities, so an author who says nothing never claims more than they checked. The claim
is verified rather than believed: `a-verb-may-claim-purity.test.ts` in `@venn-lang/stdlib` drives
every verb of every plugin with a context that records the ports it asks for, and fails any verb
that claims `pure` while asking for one.

`run(ctx, input)` receives `input.args` (the evaluated positional values) and `input.params` (the
options, already parsed by the schema). Validation happens before `run` is entered, and it fails in
the user's words:

<!-- venn-check: two diagnostics, shown as the calls that raise them -->

```ruby
crypto.hash "abc" { algorithmm: "sha512" }   # VN3001, did you mean "algorithm"
crypto.hash "abc" { algorithm: "sha5" }      # VN3010, "algorithm" must be one of the four it knows
```

A schema that declares no keys (`z.record(...)`) or welcomes unnamed ones (`z.looseObject`) accepts
a free-form map, and nothing in it is unknown.

`ActionContext` is the whole of what `run` may reach for:

| Member | Meaning |
| --- | --- |
| `port(port)` | The implementation bound to a port. This is how a plugin does I/O. |
| `secrets` | The host's `SecretProvider`: `get(name)`, `has(name)`. |
| `config` | The document's evaluated `config { … }` block, for example `baseUrl`. |
| `signal` | Aborted when a `race` this action runs inside has already been won. |
| `log(message)` | One line into the host log. |
| `show(value)` | The value as text, the way the language writes it. |
| `invoke(fn, args)` | Call a function the flow passed in. The only way to run a language closure. |

A plugin cannot redact anything after the fact, and nothing here lets it try. Redaction happens at
the producer: a value that came from `secrets.*` is a `Secret`, and a `Secret` yields `‹redacted›`
whenever it is written down, before it reaches a log or a reporter. That is every route there is:
`String(secret)` and a template literal take its `toString`, `JSON.stringify` takes its `toJSON`,
and `ctx.show` takes whichever it declares, which carries the marker through `print`, `"${…}"` and
all five `fmt` formats. Only `secret.reveal()` gives the raw value back, and it is the one call a
reviewer can grep for. A marker applied once a value has been handed out is applied too late, which
is the failure the `Secret` design exists to prevent.

`invoke` is what makes a handler argument work. `http.on` takes a `fn` and calls it per request:

```ts
server.onRequest((request) => ctx.invoke(handler, [request]));
```

`show` is what makes a verb that writes agree with the rest of the language. Reach for it whenever a
plugin turns a value into text for a person to read: a line on standard output, a label, a failure
message. It is the one definition behind `print`, `str` and `"${…}"`, so a map reads
`{ name: "ada" }`, a list `[1, 2]`, a duration `300ms`, and nothing ever reads as `[object Object]`.

```ts
run: (ctx, input) => ctx.port(ConsolePort).write(`${input.args.map((v) => ctx.show(v)).join(" ")}\n`),
```

The renderer itself lives in `@venn-lang/core`, which a plugin may not depend on, so the runtime
passes it in. That is the whole reason `show` is on the context and not an import: the alternative is
a plugin writing a renderer of its own, and two renderers disagree the moment one of them learns
about a value the other has not met. It is **required**, not optional, for the same reason. An
optional member reads as an invitation to write a fallback, and the fallback is the second
definition. A matcher's context carries the same `show`, on the same terms; see
[Matchers](#matchers).

A format is not the same thing. `fmt.json`, `fmt.csv` and `fmt.yaml` answer to a specification
outside this language and keep their own writers; `show` is for the language's own voice.

## Matchers

A matcher is registered by bare name, not under the namespace, so `expect probe up` needs no
prefix. `test` returns the verdict, `message` gives the one-line failure, and `detail` gives the two
sides so the failure carries a structured diff instead of prose. Set `aligned: false` when the two
sides were never compared field by field, as a membership check holds one needle against every item.
`appliesTo` is documentation: the editor shows it on hover.

```ts
export const contains: MatcherDefinition = defineMatcher({
  name: "contains",
  args: [arg("value", t.dynamic, "What to look for: a substring, or an item of the list.")],
  test: ({ subject, args }) => includes(subject, args[0]),
  message: ({ subject, args }, { show }) =>
    failureLine({ subject, relation: "to contain", other: args[0], show }),
  detail: ({ subject, args }) => ({ expected: args[0], actual: subject, aligned: false }),
});
```

`message` and `detail` get a second argument, the `MatcherContext`:

| Member | Meaning |
| --- | --- |
| `log(message)` | One line into the host log. |
| `show(value)` | The value as text, the way the language writes it. |

It is the same `show` an action's context carries, handed over by the same runtime for the same
reason, and **required** for the same reason: a failure title is the place a reader least deserves a
second answer about what a value looks like. Write the values of a failure with it and a red check
agrees with the `print` on the line above.

`test` does not get the context. A verdict is reached by comparing values, and a matcher holding a
renderer while deciding one is a matcher that can compare their text instead.

Matcher options are validated exactly like an action's, with the same codes and the same words.

## Decorators

`defineDecorator` contributes a `@name` that runs over the program once, before anything else reads
it. `expand(ctx)` gets the node it was written on and may leave a fact behind with `ctx.meta`, put a
different node in its place with `ctx.replace`, take it out with `ctx.remove`, or refuse the program
with `ctx.reject({ code, title })`. `targets` lists the node types it accepts; writing it elsewhere
is refused with `VN2014`, and an unknown `@name` is `VN2013`.

```ts
const drop = defineDecorator({ name: "drop", expand: (ctx) => ctx.remove() });
```

The built-ins (`@skip`, `@only`, `@serial`, `@tags`, `@timeout`, `@retry`, `@lock`, `@flaky`) have
this exact shape, and a plugin decorator of the same name replaces one. A project is entitled to its
own `@retry`.

## Durations

`Duration` is a Zod schema, so it composes into an options schema like any other:

```ts
const rampParams = z.object({ over: Duration.optional(), hold: Duration.optional() });
```

```ruby
import { load } from "venn/load"

load.ramp 0 200 { over: 30s, hold: 5m }
load.ramp 0 200 { over: "30s", hold: "5m" }
load.ramp 0 200 { over: 30000, hold: 300000 }
```

All three are the same call. `Duration` accepts the language's own `30s` literal, the string form
`"30s"` (`ms`, `s`, `m`, `h`), or a plain millisecond count, and always yields a number of
milliseconds.

It used to take only the string and the number, which meant every option built on it turned away
the literal the language is written in: `{ over: 30s }` failed both arms of the union and the run
reported `"over" is not a valid option` about an option that was declared and correct. The literal
reaches a plugin as `{ kind: "duration", ms: 30000 }`, and this schema is the one place in the SDK
that knows that shape, since a plugin package may never import `@venn-lang/core`. A cross-package
test in the runtime holds it against what the compiler produces.

A length of time no clock can honour is refused: `1s / 0` evaluates to a duration whose `ms` is
`Infinity`, which is still a duration to a renderer and no bound at all here.

`isUnitLiteral(value)` and `unitBase(value, kind)` are the same knowledge without the schema, for a
plugin that has to tell one of the language's literals (`30s`, `2mb`, `50%`, a moment) from an
ordinary map. `@venn-lang/fmt` uses them to know it has reached a leaf.

## Bytes

Text, bytes, hex and base64, in one place, because six copies of base64 in this repository
disagreed on all three axes that matter: UTF-8 handling, stack safety, and what they raise.

| Export | What it does |
| --- | --- |
| `toBytes(text)`, `fromBytes(bytes)` | UTF-8 both ways. `Bytes` is `Uint8Array<ArrayBuffer>`, the only shape WebCrypto takes. |
| `toHex(bytes)`, `fromHex(hex)` | Lowercase hex both ways. |
| `toBase64(bytes)`, `fromBase64(text)` | Padded base64 (RFC 4648 §4). |
| `toBase64Url(bytes)`, `fromBase64Url(text)` | The JWT flavour: `+/` as `-_`, no padding. |
| `equals(left, right)` | Constant-time comparison. Every digest and signature check uses it. |

None of it uses `btoa` or `atob`, and that is the point rather than a detail:

- **`btoa` cannot do UTF-8.** It reads one code unit at a time and refuses anything above U+00FF, so
  every caller had to flatten bytes to a latin-1 string first. Three callers skipped the step: an
  accented password went onto the wire as different bytes, the server answered 401, and nothing in
  Venn said why.
- **The usual flattening is not stack-safe.** `String.fromCharCode(...bytes)` spreads one argument
  per byte, so 200 KB of text raised `RangeError: Maximum call stack size exceeded`, which the CLI
  reporter turns into `VN8003  This went too deep: something calls itself and never stops`, about a
  program containing no recursion at all.
- **`btoa` is not everywhere.** It is absent on some targets this has to run on.

Encoding is alphabet arithmetic instead: no intermediate string, no argument list, no platform to be
missing, and it cannot raise. Decoding raises `VennError` `VN7003` for a character that is not a
base64 digit, where `atob` raised a `DOMException`, which carries no `VNxxxx` code and so reached the
reporter as an unrecognised throw with no line under it. ASCII whitespace is ignored and padding is
optional, as the WHATWG forgiving-base64 rules have it.

## The CryptoEngine port

`venn.port.crypto-engine`, contract version 2, capability `random`, four methods: `digest`,
`hmac`, `derive`, `randomBytes`. Every one answers in lowercase hex.

`randomBytes` draws, so `random` is what the port asks the host for. A port binds as a whole, and a
plugin declares what its ports require, so `@venn-lang/crypto` and `@venn-lang/auth` require
`random` as well. That is what a host is asked for before a line runs: one offering no `random` is
refused at load with `VN2010` naming the plugin, rather than dying at the first digest.

<!-- venn-check: a digest worked out inside a `fn`, which is where its callers wanted it -->

```ruby
import { crypto } from "venn/crypto"
fn digest(text) { return crypto.hash(text) }
```

A digest is deterministic and pays for the draw's declaration anyway. Where the call may be written
is not this port's business: a `fn` reaches the world like any other body, and a verb that reaches
nothing still says so per verb with `pure: true`; see [Actions](#actions).

This is the one port declared in the SDK rather than in the package whose verbs use it. Both
`@venn-lang/crypto` and `@venn-lang/auth` need it, a plugin may not depend on another plugin, and
the SDK is the package every plugin already has. `@venn-lang/auth` reached the global
`crypto.subtle` instead, so a host that bound `createFakeCryptoEngine` made `crypto.hmac`
reproducible and left `auth.hmac`, `auth.totp` and `auth.jwt` on real WebCrypto: half a run
replayable, half not.

`createWebCryptoEngine()` is the real one. `createFakeCryptoEngine()` is a deterministic FNV-1a
stand-in, never secure, so a flow's assertions over a digest replay. Both run
`cryptoEngineSuite`. `hmac` takes bytes as well as text, because a HOTP counter is eight raw bytes
and byte `0x80` is not a character.

`HASH_ALGORITHMS` is the one list of digests, `hashAlgorithm(written)` maps whatever a script wrote
(`SHA-256`, `sha256`) onto one of them or raises `VN7005`, and `jwsHash(alg)` says which digest a
token's `alg` header names. There were three of those tables and they disagreed.

## Reaching I/O

A plugin never calls `fetch`, `fs` or a driver directly. It asks the context for a port and calls
the interface:

```ts
run: (ctx, input) => ctx.port(HttpClientPort).request({ method: "GET", url: input.args[0] }),
```

The port descriptor (`id`, `version`, `requires`, `methods`) lives in `@venn-lang/contracts`, or in
the package whose verbs use it, and the implementation is bound at startup. That is what lets the
same plugin run against a real client in production and a fake one in tests. Every port ships with
both, plus a conformance suite they both pass.

`CryptoEnginePort` is the one declared here instead, because two plugins need it and neither may
depend on the other. See [The CryptoEngine port](#the-cryptoengine-port).

## When a verb fails

Three ways for a verb to end badly, and one rule for choosing between them. A person cannot learn
a rule that was never written, so this is the rule: a verb that disagrees with it is a bug.

**The world failed, so raise.** A refused connection, a socket that will not bind, a driver that is
not there. Nothing the program wrote is wrong and nothing it can read would help, so the run ends
where the world did. Raise a `VennError` with the code that matches: `VN7xxx` for an action or a
protocol, `VN8xxx` for a resource or a timeout.

```ts
throw new VennError({ code: PLUGIN_CODES.VN7020_PORT_TAKEN, message: `Port ${port} is taken.` });
```

**The caller made a mistake, so raise.** A timezone that is not a timezone, a range whose end is
below its start, a list to choose from with nothing in it. It is a bug in the program, and the run
ending at the bug is the shortest way to the fix. `VN7005_BAD_ARGUMENT`.

```ts
throw new VennError({
  code: PLUGIN_CODES.VN7005_BAD_ARGUMENT,
  message: `There is no timezone called ${zone}.`,
});
```

**The data was unreadable, so answer with nothing.** Text that came from a server, a header that
may not be there, a field nobody set. Being unreadable is an ordinary thing for data to be, and a
program that reads data is written to expect it, so `null` is the answer and not a failure.

```ts
run: (_ctx, input) => parsed(String(input.args[0] ?? "")) ?? null,
```

A `tryX` twin belongs only where **both** readings are common enough to want a name each, as with
`json.parse` and `json.tryParse`: one for a payload that was promised to be JSON, where the promise
being broken ends the run, and one for text nobody promised anything about. Never as the only
spelling, and never for a verb where one of the two readings is rare.

The failure a program catches carries the code, the message, where it happened and whatever was
attached to it, so a caller can tell one failure from another. Give a code that says which kind of
thing went wrong, and a message in the product's voice, in the user's domain: `There is no timezone
called Nowhere/Fake.`, never `RangeError: invalid time zone`.

## Running a plugin

`@venn-lang/runtime` takes the definitions and a host, and nothing else:

```ts
import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { createFakeClient, HttpClientPort } from "@venn-lang/http";
import { createMemorySink, createRunner } from "@venn-lang/runtime";
import { uptimePlugin } from "./plugin.js";

const runner = createRunner({
  host: createTestHost(),
  plugins: [uptimePlugin],
  ports: [{ port: HttpClientPort, impl: createFakeClient() }],
  sink: createMemorySink(),
});

const result = await runner.run(parse(source).ast);
```

## See also

- [`@venn-lang/types`](../types) for `t`, the `TypeSpec` builder every `args` and `typeDefs` entry uses.
- [`@venn-lang/contracts`](../contracts) for `Host`, `Port`, capabilities and the test doubles.
- [`@venn-lang/http`](../std-http) for the reference plugin: actions, matchers, two ports, both fakes.
