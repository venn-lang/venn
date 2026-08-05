# @venn-lang/types

> The language's type vocabulary as plain data: ten shapes, no dependencies, no compiler.

A `TypeSpec` is what a plugin publishes about itself and what the checker reads back. It is data
only, so it survives `JSON.stringify`: a signature written by hand today and one generated from a
`.d.ts` tomorrow are the same bytes. The compiler's own `Type`, with the inference variables that
unification writes into, is a separate and internal thing. Nothing mutable lands here.

This package is the shared vocabulary that lets the compiler, the plugin SDK and the `.d.ts` reader
talk about types without depending on one another. It has no dependencies at all, and its whole
runtime is one object literal (`t`) and one function (`showSpec`).

## Usage

Write the type of a verb, and the types it takes and gives back:

```ts
import { t, type TypeSpec } from "@venn-lang/types";

// http.on server handler
const signature = t.fn(
  [t.ref("http.Server"), t.callback([t.ref("http.Request")], t.dynamic, 1)],
  t.void,
);

// http.Request, as the handler receives it
const request: TypeSpec = t.record({
  method: t.string,
  url: t.string,
  headers: t.map(t.string),
  body: t.string,
});
```

That is the whole mechanism behind an editor knowing what `req` is with nothing written down:

```ruby
import { http } from "venn/http"

const api = http.serve { port: 0 }
http.on(api, route)

# `http.on` says it hands its handler a request, so `req` is `http.Request`.
fn route(req) {
  req.url.before("?")
}
```

## API

Everything `src/index.ts` exports.

| Export | What it is |
| --- | --- |
| `TypeSpec` | The union of the ten shapes. The wire format of a Venn type. |
| `PrimSpec`, `PrimName` | A scalar. `string`, `number`, `bool`, `null`, `void`, plus the units the language treats as first class: `duration`, `size`, `percent`, `instant`. |
| `LiteralSpec` | A single value (`"GET"`, `200`, `true`). What makes an enum an enum. |
| `ListSpec`, `MapSpec` | `list<T>`, and keys not known ahead of time with values all alike. |
| `RecordSpec` | Known fields, with `optional` naming those that may be absent and `open` saying whether extras are tolerated. |
| `FnSpec` | Params, result, and an optional `takes`: how many params the caller must actually accept. |
| `UnionSpec` | Members, any of which will do. |
| `OpaqueSpec` | A named handle with no visible inside. `members` is what it does publish. |
| `RefSpec` | A named type resolved through the catalog: `http.Request`. |
| `DynamicSpec` | Unknown, and deliberately so. Unifies with everything, never errors. |
| `TypeManifest` | What a plugin publishes as a whole: named `types`, and one `FnSpec` per action under `actions`. |
| `t` | The authoring surface. See below. |
| `TypeBuilder`, `RecordOptions` | The type of `t`, and the second argument of `t.record`. |
| `showSpec(spec)` | A spec as one line of text. |
| `DERIVED_TYPES_DIR`, `derivedTypesFile(name)` | Where an install leaves the types it derived from a package's TypeScript declarations, and what it calls each file. Segments rather than a path: the CLI joins with `node:path` and the language server with Langium's `UriUtils`, and neither may import the other. |

### `t`

Constants: `t.string`, `t.number`, `t.bool`, `t.null`, `t.void`, `t.duration`, `t.size`,
`t.percent`, `t.instant`, `t.dynamic`.

| Call | Builds |
| --- | --- |
| `t.literal(value)` | `"GET"`, `200`, `true` |
| `t.list(element)` | `list<element>` |
| `t.map(value)` | keys unknown, values all `value` |
| `t.record(fields, { optional, open })` | a shape with known fields |
| `t.fn(params, result)` | a function, arity as written |
| `t.callback(params, result, takes)` | the same, but usable by a caller that accepts only `takes` of them |
| `t.union(...members)` | any of the members |
| `t.opaque(name, members?)` | a handle, with an optional published surface |
| `t.ref(name)` | a named type, resolved later |

`t.callback` is what makes `req => ...` a valid handler for a verb that also offers the server: a
callback handed more than it needs is still a good callback. `t.fn` leaves `takes` off, so plain
arity means what it says.

### `showSpec`

Reads the wire format directly rather than going through the checker, so nothing has to be resolved
and a package with no compiler in it can still say what it takes. A `ref` or an `opaque` shows as
the name the plugin published, not the shape behind it.

```ts
showSpec(t.fn([t.string], t.number));            // "fn(string) -> number"
showSpec(t.union(t.literal("GET"), t.literal("POST"))); // '"GET" | "POST"'
showSpec(t.list(t.number));                      // "list<number>"
showSpec(t.opaque("http.Server"));               // "http.Server"
```

Records stop after four fields and finish with `…N more`, because past a few fields a shape stops
informing and starts filling the line.

## The ten shapes, and why only ten

`prim`, `literal`, `list`, `map`, `record`, `fn`, `union`, `opaque`, `ref`, `dynamic`.

Everything TypeScript can say either projects onto one of these or degrades to `dynamic`. It never
degrades to a failure. Generics, conditional and mapped types are resolved by the TypeScript
compiler before anything reaches here, so what arrives is the answer rather than the machinery.

`opaque` is the border. Projecting a JS class as a record would drag its whole object graph, the
`EventEmitter`, the symbols, the hundred inherited members, into a language that means none of it.
An opaque type can be held, handed to the verbs of its own namespace, and asked for the members it
chose to publish. Nothing else.

`dynamic` is a first-class citizen, not a hole to be closed. A plugin that says nothing about its
types is still a plugin that works, and a Venn program with zero annotations still runs.

## Who reads this

| Package | What it does with a `TypeSpec` |
| --- | --- |
| [`@venn-lang/sdk`](../sdk) | `defineAction` derives an action's `FnSpec` from the `args` and `result` an author named; a plugin's named types go in `typeDefs`. |
| [`@venn-lang/core`](../core) | `specToType` reads a spec into the checker's own type, with `ref` resolved through a callback. The handle kinds in `kind-types.ts` are themselves written as specs. |
| [`@venn-lang/runtime`](../runtime) | `createTypeCatalog` qualifies what the loaded plugins publish (`Request` becomes `http.Request`) and answers the checker's questions. |
| [`@venn-lang/dts`](../dts) | Reads a package's TypeScript declarations through the compiler and emits specs. The CLI stores the result under `target/types/`. |
| [`@venn-lang/lsp`](../lsp) | `showSpec` for hover, completion detail and signature help. |

See [`docs/type-system.md`](../../docs/type-system.md) for how the pieces fit together, what runs
today and what does not.

## See also

- [`@venn-lang/sdk`](../sdk), where plugin authors reach for `t`
- [`@venn-lang/core`](../core), the checker that reads what was published
- [`@venn-lang/dts`](../dts), TypeScript declarations turned into specs
