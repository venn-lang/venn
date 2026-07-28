# @venn-lang/dts

> Reads the types an installed npm package publishes and returns them as Venn `TypeSpec`s.

A Venn file can import from a package it installed: `import { z } from "zod"`. For the checker to say
anything at all about `z`, something has to work out what `zod` publishes. That is this package. It
asks the TypeScript compiler rather than parsing `.d.ts` text, and hands back plain data that
[`@venn-lang/core`](../core) can check against without ever learning what npm is.

Node only: it loads the TypeScript compiler API.

## Usage

```ts
import { readPackageTypes } from "@venn-lang/dts";

const types = readPackageTypes({
  package: "zod",
  from: "/project/target/package.json",
});

types.exports.z; // a TypeSpec
types.covered; // { total: 42, dynamic: 3 }
```

`from` is the file the specifier is resolved against, using the same rules TypeScript itself uses.
The CLI passes the generated `target/package.json`, beside which the package manager wrote
`node_modules`.

A package that declares this:

```ts
export declare function sum(a: number, b?: number): number;
```

comes back as this:

```ts
{
  kind: "fn",
  params: [{ kind: "prim", name: "number" }, { kind: "prim", name: "number" }],
  result: { kind: "prim", name: "number" },
  takes: 1,
}
```

`takes` is how many arguments the caller must actually pass. Venn checks arity exactly, so without it
`z.string()` would read as the wrong number of arguments against a signature with one optional
parameter.

## API

| Export | Signature | What it does |
| --- | --- | --- |
| `readPackageTypes` | `({ package, from }) => PackageTypes` | Resolves the package's declaration file, runs a program over it, and converts every module export. |
| `PackageTypes` | `interface` | `{ package, exports: Record<string, TypeSpec>, covered: { total, dynamic } }`. |
| `toSpec` | `(type: ts.Type, conv: Conversion) => TypeSpec` | One TypeScript type as a `TypeSpec`. For callers that already hold a `ts.TypeChecker`. |
| `Conversion` | `interface` | What one conversion carries: the checker, the current depth, and the shared state (types already read, types open, budget left). |

`covered` is counted, not claimed. "94% of exports typed" is a number that can be checked and driven
up, and it tells a reader far more than "fully compatible", which would be false for any package
built on conditional types.

A package that cannot be resolved, or that ships no declarations, is not an error. Plenty ship none.
The answer is an empty result, and every imported name is `dynamic`, which is the truth about it.

## How a TypeScript type is projected

Everything TypeScript can say lands on one of the shapes in [`@venn-lang/types`](../types) or degrades to
`dynamic`. It never fails.

| TypeScript | `TypeSpec` |
| --- | --- |
| `string`, `number`, `boolean` | `prim` `string` / `number` / `bool` |
| `void`, `undefined` | `prim void` |
| `null` | `prim null` |
| `any`, `unknown`, `never` | `dynamic` |
| `"GET"`, `200` | `literal` |
| `T \| U` | `union`, with the `undefined` and `null` branches folded away |
| `T[]` | `list` |
| `[A, B]` | `list` of `A \| B`, since the language has no fixed-length list |
| A callable | `fn`, from the first signature only |
| An object with properties | `record`, `open` |
| Anything else | `dynamic` |

`string | undefined` is one type in Venn, a string that may not be there, so it arrives as
`prim string`. Writing it as a two-branch union would make every optional field something the reader
has to take apart before using it.

A method is a field whose type is a function, because that is what it is in Venn too. `schema.parse`
is reached the same way `schema.shape` is.

Records are `open`. The package's own type is the authority on what it holds and this reading of it is
not, so anything missed stays reachable instead of being refused.

Three limits keep a real package finishable. Conversion stops at depth 4, at a budget of 20,000
types, and at any type that leads back to itself. A package's types form a graph rather than a tree:
`zod`'s `z` holds hundreds of members and most of them lead back to the same handful of shapes, so
reading each branch on its own re-expands the same types until the machine runs out of memory.
Reading each type once and stopping at a budget is what makes this finish.

## Why the compiler

A modern package's exported types are built out of generics, conditional types and mapped types, and
none of those mean anything until something resolves them. Parsing the text gives back the machinery;
asking the compiler gives back the answer. A declaration of `Unwrap<Promise<string>>` arrives here as
`prim string`.

TypeScript is pulled in under the alias `tsc-api`, pinned to the 5.x line. TypeScript 7 is Go-native
and ships no JavaScript API until 7.1, so its package exports a version string and nothing else. 7
builds this repository, and 5.9 is a library this one package calls.

## Where it is used

`venn add` and `venn install` derive the types once, after the package manager has run, and write
them to `target/types/<package>.json`. `venn check` reads them back and binds them to the names a
file imported, so a wrong argument to `z.object` is caught without running anything.

Deriving is done at install rather than on every check because reading a large package through the
compiler takes about a second, and the answer only changes when what is installed does. The CLI also
loads this package with a dynamic `import()`, so `venn run` never pays for ten megabytes of compiler
it will not use.

## See also

- [`@venn-lang/types`](../types) defines `TypeSpec`, the vocabulary everything here is converted into.
- [`@venn-lang/core`](../core) binds these specs to imported names and checks the calls against them.
- [`@venn-lang/cli`](../cli) runs the derivation at install time and reads the result at check time.
