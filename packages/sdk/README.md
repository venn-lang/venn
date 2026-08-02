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
  version: "0.1.0",
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
| `Duration` | A `ZodType<number>`: reads `"30s"`, `"2m"`, `1500`, yields milliseconds. |
| `arg`, `optionalArg`, `restArg` | Build an `ArgSpec`, one named positional argument. |
| `signatureOf(args, result)` | The `FnSpec` those arguments describe. `defineAction` calls it for you. |
| `paramSpecs(schema)`, `paramNames(schema)` | Read a Zod options schema into `ParamSpec[]` (or just the key names). |
| `z`, `ZodType` | Zod 4, re-exported so a plugin depends on `@venn-lang/sdk` alone. |

Types are exported alongside: `PluginDefinition`, `ActionDefinition`, `MatcherDefinition`,
`MatcherDetail`, `DecoratorDefinition`, `DecoratedNode`,
`ExpandContext`, `ActionContext`, `ActionInput`, `MatcherArgs`, `MatcherContext`, `ArgSpec`,
`ParamSpec`.

## The plugin object

| Field | Meaning |
| --- | --- |
| `name`, `version` | The package identity. `name` is what a file writes in `import { … } from "…"`. |
| `namespace` | The prefix every verb gets: `namespace` `uptime` plus action `probe` is `uptime.probe`. |
| `requires` | Host capabilities: `fs`, `process`, `net`, `clock`, `random`, `secrets`, `log`, `io`. |
| `actions`, `matchers`, `decorators` | The contributions. All optional. |
| `types` | Zod schemas for the nominal data shapes the plugin publishes. |
| `typeDefs` | The same shapes as `TypeSpec` data, by short name. `Probe` is reachable from a flow as `uptime.Probe`. |

Capabilities are negotiated when the registry is built, before a single line runs. A plugin that
requires `net` on a host that does not offer it fails with `VN2010` naming the plugin and the
missing capability, never with a `TypeError` halfway through a test.

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

`run(ctx, input)` receives `input.args` (the evaluated positional values) and `input.params` (the
options, already parsed by the schema). Validation happens before `run` is entered, and it fails in
the user's words:

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
| `redact(value)` | Marks a string as secret. Present on the interface; the current runner binds it to a no-op. |

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
definition.

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
  message: ({ subject, args }) => failureLine({ subject, relation: "to contain", other: args[0] }),
  detail: ({ subject, args }) => ({ expected: args[0], actual: subject, aligned: false }),
});
```

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
load.ramp 0 200 { over: "30s", hold: "5m" }
```

It accepts a unit string (`ms`, `s`, `m`, `h`) or a plain millisecond count, and always yields a
number of milliseconds. It reads the *string* `"30s"`, not the language's own `30s` duration value.

## Reaching I/O

A plugin never calls `fetch`, `fs` or a driver directly. It asks the context for a port and calls
the interface:

```ts
run: (ctx, input) => ctx.port(HttpClientPort).request({ method: "GET", url: input.args[0] }),
```

The port descriptor (`id`, `version`, `requires`, `methods`) lives in `@venn-lang/contracts`, and the
implementation is bound at startup. That is what lets the same plugin run against a real client in
production and a fake one in tests. Every port ships with both, plus a conformance suite they both
pass.

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
