# @venn-lang/runtime

> Checks and executes a parsed Venn document: the front end, the scheduler, the plugin registry, the
> event stream.

`@venn-lang/core` turns source into an AST. This package checks it and walks it. It builds the
registry of verbs the loaded plugins contribute, runs every static pass over a file behind one
`analyze`, expands decorators, opens the scopes, runs flows and steps in the order the language says,
and emits one ordered stream of envelopes describing what happened.

It performs no I/O of its own. Every effect leaves through a port the host bound at startup, so the
package never imports `node:*` and runs unchanged in a Web Worker. The CLI and the language server
are both built on it.

## Usage

```ts
import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { createMemorySink, createRunner } from "@venn-lang/runtime";

const echo = definePlugin({
  name: "@test/echo",
  version: "0.0.0",
  namespace: "test",
  actions: [defineAction({ name: "echo", run: (_ctx, input) => ({ status: input.args[0] }) })],
});

const source = `flow "F" {
  step "S" {
    let res = test.echo 200
    expect res.status == 200
  }
}`;

const sink = createMemorySink();
const runner = createRunner({ host: createTestHost(), plugins: [echo], sink });

const result = await runner.run(parse(source).ast);
result.passed; // 1
sink.envelopes.map((envelope) => envelope.kind); // run.started … run.finished
```

`createRunner` negotiates plugins and wires ports once; the returned `Runner` is reused per run.

## API

### Running

| Export | What it does |
| --- | --- |
| `createRunner(args)` | Builds the registry, the port resolver and the decorator source, and returns a `Runner`. Throws `VN2010` when a plugin needs a capability the host does not offer. |
| `Runner` | `run(document)` runs every `flow` (test mode); `script(document)` executes the top-level statements top to bottom (script mode). Both return a `RunResult`. |
| `RunnerArgs` | `host`, `plugins`, `sink`, plus optional `ports`, `uri`, `filter`, `bail`, `env`, `cleanup`, and the import-graph fields `modules`, `moduleFragments`, `moduleDecos`. |
| `RunResult` | `run` (the run id), `passed`, `failed`, `problems` (what decorators refused before anything ran) and `exitCode` when the program called `exit`. |
| `resolveImports(args)` | Walks the import graph from one document, parsing each `.vn` file it reaches. Returns the exported fragments and decos, every `use`d package, the loaded npm modules and the parsed modules themselves. Cycles are skipped, not looped. |
| `collectUses(document, into)` | Adds the packages a document `use`s to a set. |
| `ModuleIo`, `NpmModules`, `ResolvedImports` | How a host reads source (`read`, `resolve`), how it loads an installed package, and what the walk produced. |

### Plugins and types

| Export | What it does |
| --- | --- |
| `buildRegistry({ plugins, caps })` | Checks every plugin's `requires` against the host capabilities, then indexes its actions, matchers and namespace. |
| `Registry` | Resolves `namespace.action`, a matcher by name, whether a namespace exists, the namespace a package contributes, and the full action list. |
| `ResolvedAction`, `ResolvedMatcher` | An action or matcher paired with the plugin that owns it. |
| `builtinDecorators` | The decorators the language ships with: `@skip`, `@only`, `@serial`, `@tags`, `@timeout`, `@retry`, `@lock`, `@flaky`. |
| `createDecoratorSource(plugins)` | The built-ins plus every plugin decorator. A plugin's decorator of the same name wins on purpose. |
| `createTypeCatalog(plugins)` | Turns what plugins publish (`typeDefs`, action `signature`s) into the `TypeCatalog` the checker asks. Names are qualified once here: a plugin says `Request`, a flow writes `http.Request`. |

### Events

| Export | What it does |
| --- | --- |
| `EventSink` | One method, `emit(envelope)`. The destination of the stream. |
| `createMemorySink()` | The test double: keeps every envelope on `.envelopes`. |
| `createNdjsonSink({ write })` | One JSON envelope per line. `write` is injected, so the sink stays neutral. |
| `EventSinkPort` | The port descriptor, `venn.port.event-sink`, version 1. |
| `createEmitter({ sink, run, clock })` | The single place `seq` increments and `ts` is stamped. |
| `newRunId({ clock, random })` | Mints a run id from the host clock and random source. |

### Ports, scopes and cleanup

| Export | What it does |
| --- | --- |
| `createPortResolver({ bindings, caps })` | Resolves a `Port<T>` to the bound implementation, running capability and shape negotiation. Throws `VN7002` when nothing is bound. |
| `PortBinding` | A port paired with the implementation a host chose. |
| `createScope(parent?)` | A lexical scope. `lookup` falls back to the parent, `set` writes locally, `child()` nests. Bindings live in cells, so a compiled function addresses a free name once. |
| `createCleanupList()` | The runtime's own `CleanupSink` for a host that does not bring one. `close()` runs the entries newest first and survives one that throws. |
| `Cleanup`, `CleanupList`, `CleanupSink` | What a run registers on the way out, and who owns running it. |
| `collectFragments(document)` | The document's `fragment` declarations, by name. |
| `matchesTitle(title, needle)` | Case-insensitive containment. Absent needle matches everything. |
| `RunFilter` | `tags`, `flow`, `step`: which flows and steps a run includes. |

### The front end

Every pass a `.vn` file goes through, in one place. `venn run`, `venn test`, `venn check`,
`venn build` and the editor all call this, and differ only in which severities they report and what
they exit with. Assembling the list by hand is what let `venn run` skip type checking for a whole
milestone.

```ts
import { createFrontEnd, NOTHING_IMPORTED } from "@venn-lang/runtime";

const front = createFrontEnd({ plugins, caps: host.caps });

const { problems, types } = front.analyze({
  document: parse(source, { uri }).ast,
  uri,
  graph: NOTHING_IMPORTED, // or the one a resolver walked
  decos: new Map(),
  fragments: new Set(),
  env: undefined, // undefined means "unknown", so no `env.*` read is refused
  packages: new Map(),
  unreadable: [],
  cycles: [],
});
```

| Export | What it does |
| --- | --- |
| `createFrontEnd({ plugins, caps })` | Settles the registry, the decorators, the type catalog and what the plugins publish once, and returns a `FrontEnd`. Throws `VN2010` when a plugin needs a capability the host does not offer. |
| `FrontEnd` | `analyze(args)` runs every pass over one parsed file. |
| `AnalyzeArgs` | The file, and everything only the caller can know: the module graph, the imported decos and fragments, the declared `env` names, what installed packages publish, and the unreadable imports and cycles a resolver found. Nothing here is optional. |
| `Analysis` | `problems` (every pass's, loudest first), `types` (each expression's), `slots` (what each `${…}` parsed to). |
| `NOTHING_IMPORTED` | The graph of a file that reaches nothing: an inline snippet, or a host with no way to read a neighbour. |

### Static checks

The passes themselves. Call `analyze` rather than these: a pass added to one caller and not another
is the bug the front end exists to make impossible.

| Export | What it does |
| --- | --- |
| `checkDocument(args)` | Resolves every action, matcher, fragment and `env` read in a parsed document, returning `Problem`s with source spans instead of failures mid-run. |
| `checkImports({ document, uri, graph, registry })` | Every imported name checked against what the named file or package published, with `VN2009` and a note saying whether it is private, absent, or a verb. |
| `checkFragmentCall(call, ctx)` | Reports a `fragment` invoked for a value (`VN3013`), suggesting `run name(…)`. Used inside `checkDocument`. |
| `loudestFirst(problems)` | Errors, then warnings, then hints, stably. |
| `CheckArgs` | `document`, `registry`, `fragments`, plus optional `uri` and the `env` names `venn.toml` declares. |

The codes `checkDocument` raises: `VN2003` unknown action, `VN2004` unknown matcher, `VN2005`
unknown fragment, `VN2006` undeclared `env` variable, `VN2007` namespace used without `use`,
`VN2008` a verb named but never called, `VN3013` a fragment called for a value, plus unknown option
keys from the action's own parameter schema.

## What the scheduler runs

Test mode walks the document: suite `setup`, then one full pass per `matrix` variant, then
`teardown`. Each pass binds `env` and the variant, runs the top-level statements, then the flows with
`beforeEach` and `afterEach` around each one. Script mode runs the same top-level statements as the
program itself, top to bottom, and hands `teardown` and `defer` to the host's cleanup sink, because a
program that serves outlives its last line.

Inside a flow the scheduler handles steps and groups, `if`/`else`, `forEach`, `repeat`, `while`,
`try`/`catch`/`finally`, `run <fragment>(…)`, `defer`, `on failure`/`on success`, and the prelude
verbs `print`, `log`, `wait`, `skip`, `fail`, `exit`.

```ruby
@tags(smoke)
@retry(2, { backoff: 500ms, factor: 2 })
flow "checkout" {
  parallel { concurrency: 2 } {
    step "cart"  { expect true }
    step "stock" { expect true }
  }
}
```

`parallel` takes `concurrency` (a worker pool) and `onError: "collect"`, which lets every branch
finish instead of cancelling the siblings at the first failure. `race` runs its branches until the
first settles and aborts the rest; a cancelled branch stops at its next statement boundary, and an
action that wants to be interrupted sooner listens to `ctx.signal`.

Decorators run before the scheduler sees anything: what it walks is the tree expansion left, not the
one the parser produced. `@timeout` and `@retry` wrap a flow or step body, `@lock("name")` and
`@serial` take a named mutex from the host lock provider, `@skip` and `@only` gate what runs, and
`@flaky(ratio)` is settled once at the end of the run so the verdict does not depend on the order
iterations happened to fail in.

## The event stream

Everything a reporter or a UI shows derives from the envelope stream: `seq` is monotonic per run,
`ts` comes from the host clock, and the kinds are `run.started`, `run.finished`, `flow.started`,
`flow.finished`, `flow.retrying`, `step.started`, `step.finished`, `action.started`,
`action.finished`, `expect.passed`, `expect.failed` and `log`. A failed expectation carries a whole
`Problem`, code and span included, never a flattened string.

`EventSink` is a port: `createMemorySink` and `createNdjsonSink` are its two implementations, and
both run the same conformance suite, which pins that envelopes arrive in `seq` order.

## See also

- [`@venn-lang/core`](../core) parses and checks; it produces the document this package runs.
- [`@venn-lang/sdk`](../sdk) defines the plugins, actions and matchers the registry ingests.
- [`@venn-lang/contracts`](../contracts) supplies the `Host`, the ports and the capability negotiation.
- [`@venn-lang/cli`](../cli) assembles a Node host and drives the runner.
