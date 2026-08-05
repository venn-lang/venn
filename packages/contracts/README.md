# @venn-lang/contracts

> The ports the Venn core runs on, their implementations, and the host that carries them.

The core knows nothing about files, clocks, subprocesses or secrets. It knows **ports**: small
typed interfaces whose implementations arrive at startup inside a `Host` object. This package
defines every port, ships two implementations of each (a real one and a test double), and provides
the conformance suites both must pass. There is no DI container and no runtime resolution: the
entry point assembles a `Host` and passes it inward.

## Usage

The CLI assembles the Node host and hands it to the runtime:

```ts
import { createNodeHost } from "@venn-lang/contracts/node";

const host = createNodeHost({ root: process.cwd() });
await host.fs.write("out/report.json", new TextEncoder().encode("{}"));
```

Tests take the all-doubles host, overriding only what the test cares about:

```ts
import { createTestHost, createVirtualClock } from "@venn-lang/contracts";

const host = createTestHost({ clock: createVirtualClock({ start: 1_700_000_000_000 }) });
await host.clock.sleep(5_000); // resolves immediately; now() moved on by 5000 ms
```

Binding an implementation to a port goes through `bindPort`, which negotiates capabilities and
then checks the shape:

```ts
import { bindPort, createMemoryFs, FileSystemPort } from "@venn-lang/contracts";

const fs = bindPort({ port: FileSystemPort, impl: createMemoryFs(), caps: ["fs"] });
// caps: [] throws VN2010. An impl without `list` throws VN2011.
```

## Entry points

| Specifier | Platform | Holds |
| --- | --- | --- |
| `@venn-lang/contracts` | neutral (Node and Web Worker) | ports, doubles, hosts, errors, capability negotiation |
| `@venn-lang/contracts/node` | Node | the `node:*`-backed implementations and `createNodeHost` |
| `@venn-lang/contracts/testing` | test | the conformance suites; imports vitest and fast-check |

The split is enforced by the build, not by convention: `index` and `testing` are built with tsdown
`platform: "neutral"`, so a stray `node:*` import fails the build. That is what lets
[`@venn-lang/core`](../core) run inside the editor's Web Worker.

## Two implementations or it is not a port

Every port lands in a single commit with three things: the real implementation, the test double,
and a conformance suite (TCK) that both of them run. If you cannot name the second implementation
straight away (`memory`, `fake`, `seeded`, `fixed`, `virtual`), it is not a port. It is a module
with a good interface, and it should stay one.

`Port<T>` is a TypeScript descriptor, not a Zod schema. In Zod 4 `z.function()` is a factory rather
than a validatable type, so a port's function shape cannot be expressed as data. Zod stays on data.

```ts
export interface Port<T> {
  readonly id: string;                             // "venn.port.filesystem"
  readonly version: number;                        // the contract version, not the package version
  readonly requires: readonly HostCapability[];    // negotiated against Host.caps
  readonly methods: readonly (keyof T & string)[]; // checked against the interface by the compiler
}
```

Three checks, in order:

1. **Compile time.** `methods` cannot name anything that is not a key of `T`.
2. **Load time.** `bindPort` compares `requires` against `Host.caps` (VN2010), then checks
   `typeof impl[m] === "function"` for each declared method (VN2011).
3. **Behaviour.** The conformance suite. The suite is the specification; the prose is commentary.

`AnyPort` is `Port<T>` with the element type erased, so heterogeneous collections of ports can be
typed without variance friction.

## Ports

| Port | Descriptor | Requires | Methods | Real | Double |
| --- | --- | --- | --- | --- | --- |
| `FileSystem` | `venn.port.filesystem` | `fs` | `read` `write` `exists` `remove` `list` | `createNodeFs` (`/node`) | `createMemoryFs` |
| `Clock` | `venn.port.clock` | `clock` | `now` `sleep` | `createSystemClock` | `createVirtualClock` |
| `Random` | `venn.port.random` | `random` | `next` `int` `restart` | `createSeededRandom` | `createFixedRandom` |
| `Paths` | `venn.port.paths` | none | `cwd` `join` `resolve` `relative` `normalize` `dirname` `basename` `extension` `isAbsolute` `split` | `createPosixPaths` | `createPosixPaths({ cwd })` |
| `Console` | `venn.port.console` | `io` | `write` `writeError` `readLine` `args` | `createNodeConsole` (`/node`) | `createMemoryConsole` |
| `SecretProvider` | none | `secrets` | `get` `has` | `createEnvSecrets` | `createMemorySecrets` |
| `ProcessProvider` | none | `process` | `spawn` | `createNodeSpawn` (`/node`) | `createFakeProcess` |
| `SignalSource` | none | `process` | `on` | `createNodeSignals` (`/node`) | `createFakeSignals` |
| `LockProvider` | none | none | `acquire` | `createInProcessLock` | `createFakeLock` |
| `ManifestProvider` | none | none | `load` | `createTomlManifest` | `createMemoryManifest` |

Implementations marked `/node` are reachable only through `@venn-lang/contracts/node`, and are
deliberately absent from the folder barrels so the main entry stays neutral.

Five ports export a descriptor, and those five are the ones something binds and resolves:
`FileSystemPort`, `ClockPort`, `RandomPort`, `PathsPort` and `ConsolePort`. A descriptor exists to
be negotiated, `bindPort` checking the host's capabilities and the implementation's methods at the
moment a plugin asks for it, so a port nothing resolves has no use for one. The other five are
reached straight off `Host` by the code that needs them, and no longer publish a descriptor. A host
embedding this that wants one of them negotiated declares its own `Port<T>` and binds it: the
interface, both implementations and the conformance suite are all still exported.

`Paths`, `LockProvider` and `ManifestProvider` require no capability: one is string arithmetic, one
is promise chaining, the last is parsing. None touches the outside world.

### Notes on individual ports

- **FileSystem.** `read` and `remove` on a missing path throw VN8010, never a raw `ENOENT`.
  `list` is one level deep and reads a non-directory as empty. `createNodeFs({ root })` resolves
  relative paths against `root` and leaves absolute paths alone.
- **Clock.** `createVirtualClock` makes `sleep` advance internal time and resolve at once. Its
  `advance` and `setTime` sit outside `ClockPort.methods` on purpose: they are test controls, not
  part of the negotiated contract. `sleep(ms, signal)` takes an optional signal (contract version
  2): an aborted sleep resolves early instead of rejecting, and the real clock drops its timer, so
  a cancelled wait does not hold the process open.
- **SecretProvider.** `makeSecret({ reveal })` wraps a raw value so that `toString()` and
  `toJSON()` both collapse to `REDACTED`. `reveal()` is the only way out, and it is deliberately
  explicit. Redaction happens at the producer, so anything reaching a reporter is already marked.
- **ProcessProvider.** `spawn` streams each chunk to `onOutput` as it arrives and keeps the same
  text in `ProcessResult.output`. `SpawnArgs.env` adds to the host environment rather than
  replacing it, and `shell` is off unless the caller asks for it.
- **SignalSource.** The fake is what tests use: raising a real SIGINT would stop the test runner
  rather than the code under test. `createNodeSignals` subscribes silently to a signal the platform
  does not have, which `isKnownSignal` reports on directly.
- **ManifestProvider.** `createTomlManifest({ content })` parses a `venn.toml` into a `Manifest`:
  `[package]`, `[lib]` and `[[bin]]` targets, dependencies, `[patch]`, profiles, `[tooling]`,
  `[workspace]`, `[env.*]`, `[paths]` and `[format]`.

### Walking up a tree of directories

`ancestorsOf(path)` is the one upward walk in the repository: a directory and every directory
above it, nearest first, as text and with no `node:path`, so the editor's Web Worker walks what
the CLI walks. It ends at `/` for a unix path, `c:/` for a Windows one and `""` for a relative
one, and an absolute walk never yields a relative step: falling off the drive root is how a file
outside every project used to be governed by whatever directory the shell was standing in.
`parentDirOf(path)` is one step of it and `normalisePath(path)` is how both spell a path.

### Manifest helpers

Reading and rewriting `venn.toml` without going through a provider:

| Export | What it does |
| --- | --- |
| `parseToml(content)` | The `venn.toml` subset: sections, nested `[a.b]`, `[[bin]]`, scalars, arrays, inline tables |
| `tomlDocs(content)` | The comment block written directly above each key, as that key's documentation |
| `defaultManifest(overrides?)` | A `Manifest` with nothing declared, which is what a project with no `venn.toml` gets |
| `resolveAlias({ spec, paths })` | Splits a `#alias/rest` specifier against `[paths]`, or `undefined` when it names no alias |
| `addDependency({ text, name, version, table? })` | The manifest text with one dependency written in, kept in name order |
| `removeDependency({ text, name, table? })` | The manifest text without that dependency |
| `readInheritable(data)` | The subset of `[package]` a workspace member may inherit. A name is never inherited |
| `DEPENDENCIES` `DEFAULT_PROFILES` `LIB_ROOT` `MAIN_ROOT` `BIN_DIR` | The conventional table name, profiles and target roots |

Types: `Manifest`, `FormatSettings`, `PackageInfo`, `BuildTarget`, `TargetKind`, `Dependency`,
`Profile`, `ToolingSettings`, `WorkspaceSettings`, `PackageManagerName`, `DependencyEdit`,
`AliasTarget`.

## Capabilities and the host

`ALL_CAPABILITIES` is the full set: `fs`, `process`, `net`, `clock`, `random`, `secrets`, `log`,
`io`. A host advertises the subset it can actually serve in `Host.caps`, and a port declares what
it needs in `requires`. Negotiation compares the two before anything runs.

```ts
export interface Host {
  readonly fs: FileSystem;
  readonly proc: ProcessProvider;
  readonly clock: Clock;
  readonly random: Random;
  readonly secrets: SecretProvider;
  readonly log: Logger;
  readonly lock: LockProvider;
  readonly caps: readonly HostCapability[];
}
```

| Assembler | Capabilities | Built from |
| --- | --- | --- |
| `createHost.worker()` | `fs` `clock` `random` `secrets` `log` | memory fs, system clock, seeded random, memory secrets and logger |
| `createHost.test(overrides?)` | all eight | doubles throughout, with any field overridable |
| `createNodeHost({ root? })` (`/node`) | all eight | node fs, real spawn, system clock, env secrets, console logger |

`createWorkerHost` and `createTestHost` are also exported directly; `createHost` is the object that
groups the two neutral ones. The Node assembler is deliberately not on it, because it pulls in
`node:*`.

A worker has no `process`, so its `proc` field is built by `unavailable()`. Every declared method
on it throws VN2012 with a readable message, rather than a `TypeError` halfway through a test. The
method list is written out, because there is no `ProcessProviderPort` to read it off.

```ts
import { unavailable } from "@venn-lang/contracts";
import type { ProcessProvider } from "@venn-lang/contracts";

const proc = unavailable<ProcessProvider>({ capability: "process", methods: ["spawn"] });
```

## Conformance

A suite takes a `ConformanceSpec<T>`: a display name and a `factory` that returns a fresh
implementation, synchronously or not. Running it is one call per implementation.

```ts
// file-system.test.ts
import { fileSystemConformance } from "@venn-lang/contracts/testing";

fileSystemConformance({ name: "memory", factory: () => createMemoryFs() });
fileSystemConformance({
  name: "node-fs",
  factory: async () => createNodeFs({ root: await mkdtemp(join(tmpdir(), "venn-fs-")) }),
});
```

Some suites ask for more than the spec: `secretProviderConformance` takes a `known` secret,
`manifestProviderConformance` takes an `expectedName`, `processProviderConformance` takes `runs`
and `expected`, and `signalSourceConformance` takes a whole `SignalSpec` saying how a signal is
delivered to that implementation.

Exported from `@venn-lang/contracts/testing`: `clockConformance`, `fileSystemConformance`,
`lockProviderConformance`, `manifestProviderConformance`, `processProviderConformance`,
`randomConformance`, `secretProviderConformance`, `signalSourceConformance`, plus `expectVennError`
and the types `ConformanceSpec`, `PortFactory` and `SignalSpec`.

`expectVennError({ op, code })` asserts that an async operation rejects with a `VennError` whose
`.code` matches a regex. Suites assert on codes, never on prose, so error wording stays free to
improve.

Adding an implementation to an existing port is one new file, one line in the folder barrel and one
line in the test. The suite itself is never touched.

## Errors

Every failure crossing a contracts boundary is a `VennError`: an `Error` with a stable `code` and
an optional structured `detail`.

| Code | Raised by | When |
| --- | --- | --- |
| `VN2010` | `hostMissingCapability` | a port requires a capability the host does not advertise |
| `VN2011` | `portShapeMismatch` | an implementation is missing a method the port declares |
| `VN2012` | `capabilityUnavailable` | code reached a capability the host marked unavailable |
| `VN8010` | `fsNotFound` | a read or remove targeted a path that does not exist |

## Environment files

Both the runner and the editor resolve dotenv files through the same three exports, so they cannot
disagree about where a value lives.

| Export | What it does |
| --- | --- |
| `DOTENV_CONVENTION` | `.env`, `.env.${name}`, `.env.local`, `.env.${name}.local`, lowest precedence first |
| `dotenvFiles({ configured?, name })` | Which files to read, in order, for one environment |
| `parseDotenv(content)` | `NAME=value` per line, with comments, blanks, `export ` and quotes. No variable expansion |
| `declaredEnvNames({ sections, dotenv? })` | Every variable a project declares, whichever environment runs: the union of every `[env.*]` section and the dotenv names, plus the built-in `name`. `undefined` where there is no manifest, which means "unknown", so no `env.*` read is refused. `venn check`, `venn run` and the editor all ask this |

## Logging

`Logger` has a single method, `log(entry)`, where an entry is a `LogLevel` and a message.
`createConsoleLogger()` writes through the global console and is safe in both Node and a worker.
`createMemoryLogger()` returns a `MemoryLogger`, which keeps every entry in `entries` for
assertions.

## See also

- [`@venn-lang/core`](../core) receives a `Host` and imports nothing else for I/O.
- [`@venn-lang/runtime`](../runtime) executes flows against that host.
- [`@venn-lang/cli`](../cli) assembles the Node host and is the only package free to use `node:*`.
