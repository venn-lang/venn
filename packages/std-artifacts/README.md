# @venn-lang/artifacts

> The `artifacts` namespace: record the traces, videos, HARs and screenshots a run produces.

A flow that fails is only useful if you can see what it left behind. This plugin gives a run three
verbs for filing artifacts and hands every one of them to the `ArtifactStore` port, so where the
bytes actually live is a decision the host makes at startup and not something baked into the
language.

## Install

Nothing to install. `@venn-lang/artifacts` is part of the standard library, and the CLI and the language
server both load [`@venn-lang/stdlib`](../stdlib), which lists every stdlib plugin. A file reaches the
namespace with one line.

```ruby
import { artifacts } from "venn/artifacts"
```

## Usage

```ruby
module demo.checkout

import { artifacts } from "venn/artifacts"
import { assert } from "venn/assert"

afterEach { artifacts.flush }

flow "Checkout" {
  step "place the order" {
    expect true
  }

  on failure {
    artifacts.save "trace" "video" "har"
  }
}
```

## Verbs

| Verb | Call | Result |
| --- | --- | --- |
| `artifacts.save` | `artifacts.save "trace" "video" "har"` | `list<artifacts.ArtifactRef>`, one ref per kind |
| `artifacts.flush` | `artifacts.flush` | the refs stored since the last flush, now drained |
| `artifacts.attach` | `artifacts.attach "report.html" { kind: "report", size: 2048 }` | one `artifacts.ArtifactRef` |

`artifacts.save` takes as many kinds as you hand it. The vocabulary has no variadic, so the verb is
declared with `restArg`: the first argument says what a kind is and the ones past it are left
unchecked, which is better than describing them wrongly. Both call spellings work, with spaces in
the bareword form and commas inside brackets:

```ruby
artifacts.save "trace" "video" "har"
artifacts.save("trace", "video", "har")
```

`artifacts.attach` names the artifact positionally; `kind` (default `"attachment"`) and `size` are
options. `flush` drains the pending buffer and leaves the stored refs in place, so calling it twice
in a row returns an empty list the second time.

## The type it publishes

`artifacts.ArtifactRef` is a record of `name: string`, `kind: string` and an optional
`size: number`. It is what every verb hands back, and what hover and completion in the editor read.

## The ArtifactStore port

| | |
| --- | --- |
| id | `venn.port.artifact-store` |
| version | 1 |
| requires | `fs` |
| methods | `put`, `get`, `list`, `flush` |

Two implementations ship together, which is what makes this a port rather than a module with a good
interface:

- `createMemoryArtifactStore()` keeps a `Map` of stored refs plus a pending buffer. This is the one
  [`@venn-lang/stdlib`](../stdlib) binds, so the verbs work offline.
- `createRealArtifactStore()` is a stub. Every call throws a `VennError` with code `VN8090`, because
  this repository is the language and ships no real storage backend.

Both run the same conformance suite, `artifactStoreConformance` in
`src/store/artifact-store.suite.ts`. A third implementation is one file, one line in the local
`index.ts` and one line in the test.

The port lists `flush` among its methods on purpose. A method the descriptor leaves out is a method
nobody checks at load time, and it would surface as a `TypeError` mid-run instead of a legible
`VN2011` before anything starts.

## API

| Export | What it is |
| --- | --- |
| `artifactsPlugin` | The plugin definition: namespace `artifacts`, `requires: ["fs"]`. Also the default export. |
| `ArtifactStorePort` | The port descriptor. |
| `ArtifactStore` | The port interface: `put`, `get`, `list`, `flush`. |
| `createMemoryArtifactStore()` | The in-memory double. |
| `createRealArtifactStore()` | The real store, stubbed to throw `VN8090`. |
| `ArtifactRef` | The TypeScript type: `{ name, kind, size? }`. |
| `ArtifactRefSchema` | The Zod schema registered as the plugin's nominal `ArtifactRef` type. |
| `artifactsTypeDefs` | The `TypeSpec` for `artifacts.ArtifactRef`, which the checker and the LSP read. |

Binding a different store means one entry in the runner's port list:

```ts
import { ArtifactStorePort, createMemoryArtifactStore } from "@venn-lang/artifacts";
import { createRunner } from "@venn-lang/runtime";

const runner = createRunner({
  host,
  plugins,
  sink,
  uri,
  ports: [{ port: ArtifactStorePort, impl: createMemoryArtifactStore() }],
});
```

## See also

- [`@venn-lang/sdk`](../sdk) for `definePlugin` and `defineAction`.
- [`@venn-lang/contracts`](../contracts) for `Port`, `assertPortShape` and `VennError`.
- [`@venn-lang/notify`](../std-notify) for telling someone about a run that failed.
