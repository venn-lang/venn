# @venn-lang/fmt

## 0.9.0

### Patch Changes

- Updated dependencies []:
  - @venn-lang/sdk@0.9.0
  - @venn-lang/types@0.9.0

## 0.8.1

### Patch Changes

- Updated dependencies []:
  - @venn-lang/sdk@0.8.1
  - @venn-lang/types@0.8.1

## 0.8.0

### Patch Changes

- Updated dependencies []:
  - @venn-lang/sdk@0.8.0
  - @venn-lang/types@0.8.0

## 0.7.5

### Patch Changes

- Updated dependencies []:
  - @venn-lang/sdk@0.7.5
  - @venn-lang/types@0.7.5

## 0.7.4

### Patch Changes

- Updated dependencies []:
  - @venn-lang/sdk@0.7.4
  - @venn-lang/types@0.7.4

## 0.7.3

### Patch Changes

- Updated dependencies []:
  - @venn-lang/sdk@0.7.3
  - @venn-lang/types@0.7.3

## 0.7.2

### Patch Changes

- Updated dependencies []:
  - @venn-lang/sdk@0.7.2
  - @venn-lang/types@0.7.2

## 0.7.1

### Patch Changes

- Updated dependencies []:
  - @venn-lang/sdk@0.7.1
  - @venn-lang/types@0.7.1

## 0.7.0

### Minor Changes

- [#250](https://github.com/venn-lang/venn/pull/250) [`47b4cbd`](https://github.com/venn-lang/venn/commit/47b4cbdc9a5f54ef9c2fca2a715e38ecf273edfb) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - A table cell holding a map or a list now reads the way the language writes
  it, not the way `JSON.stringify` does.

  ```venn
  print fmt.table([{ name: "ada", marks: { homework: 95, final: 92 } }])
  ```

  ```
  name │ marks
  ─────┼──────────────────────────
  ada  │ { homework: 95, final: 92 }
  ```

  was `{"homework":95,"final":92}` before: the host's shape, not the
  language's. A table is written for a person to read, and `{ homework: 95,
final: 92 }` is what that person would have typed, the same text `print` and
  `"${…}"` already give for the same value.

  `fmt.json`, `fmt.csv`, `fmt.xml` and `fmt.yaml` are unchanged. They answer to
  formats outside this language, and a CSV field written the Venn way would be
  a broken CSV.

- [#309](https://github.com/venn-lang/venn/pull/309) [`4c1eac1`](https://github.com/venn-lang/venn/commit/4c1eac1e18717cf39b5f7d75aa596c52f31a7457) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - What a value is, and what it answers to, is decided in one place.

  ```venn
  const m = { name: "ada" }
  print m["toString"]     # was a host function; now null
  print m["constructor"]  # was a host function; now null

  let p = { a: 1 }
  p["constructor"]["prototype"]["pwned"] = 7
  ```

  That last line polluted every object, list and string in the process, across
  concurrently running flows, and `venn check` said nothing about it. It is now
  `VN3023`, from every route: a computed key, a key out of a `forEach`, a list
  index, a nested write, inside a `fn`, inside a step and inside a fragment.

  Six classifiers disagreed about what a value is. `typeName` trusted any `kind`
  string an object carried, so an ordinary map `{ kind: "size", label: "x" }`
  answered `"size"` to `typeOf` and `null` to `.label`, while the checker typed
  that same field as a string. The unit guards asked only for a `kind`. `isData`
  re-inlined the four unit names. `tableFor` knew ten kinds, `memberKind` seven,
  and `structured` had an order of its own. `core/src/value/` owns the question
  now, and `kindOf` answers from a closed set, so `typeOf` can never hand back a
  name the language does not have.

  A unit is recognised by its base field as well as its kind: a duration needs a
  numeric `ms`, a size a numeric `bytes`. A symbol brand would have been tighter
  and was rejected, because `structuredClone` drops symbols and `std-db` clones
  every row it hands back, so a duration read out of a query would have stopped
  being one.

  **Three readers became one.** `memberValue` had five guards, `elementAt` had
  none, and `read-path.ts` had `Array.isArray` and answered `undefined` where the
  language has one nothing. Reading a member and reading an index are one
  question, so they now go through one answer, and a position is a position in
  both spellings: `xs[0]` and `xs["0"]` are the same element, `m[1]` and `m["1"]`
  are the same key. The checker learned the same rule, so `const t: number =
m["name"]` is refused exactly as `m.name` always was, and `names["len"]` stops
  being typed as an element.

  **A duration literal is accepted where a duration is declared.** `{ over: 30s }`
  was refused with `"over" is not a valid option.` while `{ over: "30s" }` ran,
  on all six option keys the SDK's own duration primitive guards, because the
  schema was a union of a string and a number and a Venn duration is neither. The
  one exception, `mock.clock`, worked only by unwrapping the value by hand.

  The message was wrong as well as late. A union rejection carries no `expected`,
  so every one of them fell through to the sentence that says the option does not
  exist. The option existed; the value was the wrong shape, and it says so now,
  at check time as well as at run time.

  Five hand-rolled duration unwrappers gave four different answers to "what is
  this if it is not a duration": `NaN`, `0`, `undefined`, and `0` inside
  `undefined`. There is one, and a deliberate line through it: recognition
  tolerates a non-finite `ms`, because `1s / 0` legitimately makes one and
  printing it as a map would be the leak this change exists to close, while
  acceptance refuses it one step before it becomes a timer.

  **One byte module.** Six base64 encoders differed on UTF-8, on stack safety and
  on what they raised. `auth.basic("user", "señha")` sent latin-1 bytes where RFC
  7617 requires UTF-8, so the server answered 401 and nothing said why; with a
  character above U+00FF it threw a bare `Invalid character` with no code and no
  location; and 200 KB through `crypto.base64.encode` raised `VN8003`, "something
  calls itself and never stops", for a program containing no recursion.

  The shared module uses no `btoa` at all. `btoa` cannot do UTF-8, the usual way
  of feeding it is the spread that produced the false `VN8003`, and it is not
  everywhere this has to run. Encoding is alphabet arithmetic and cannot raise;
  decoding refuses with `VN7003`.

  `CryptoEnginePort` moved beside it so `auth.hmac`, `auth.totp` and `auth.jwt`
  reach the bound engine rather than the global one, which is what makes a fake
  engine reach them. And a token is now what it says it is: `auth.jwt` wrote the
  caller's `alg` into the signed bytes and signed with SHA-256 regardless, so
  `crypto.jwt.verify` read `HS512`, hashed with SHA-512 and answered false for a
  token nothing had touched.

  **One owner each**, for ten things written several times: which file a node came
  from, the span of a `${…}` slot, the unlocatable span, whether a node sits
  inside a decorator, the "a, b or c" sentence, the name you probably meant, one
  problem on a node, the tree inside an editor document, a path as a person reads
  it, and the derived-types layout. The first was user-visible: the same `VN3015`
  printed `at orders.vn:3:16` through the scheduler and no location at all inside
  a compiled `fn`, and the corpus that exists to catch that divergence recorded
  neither a uri nor a line, so it could not. It records the uri now, and went red
  before it went green.

  Three Levenshtein cutoffs disagreed about the same typo, so `tkn` reached
  `token` from the option checker and nothing from the three checks next door.
  There is one, and it is length-aware in both directions: a two-letter name no
  longer suggests every other two-letter name.

  **Thirteen declarations that promised something.** `Problem.docs` was declared,
  printed, published to programs as `error.docs`, and set by nobody; it is derived
  from the code, in one place, and the editor renders it as a link. `optional =
true` on a dependency said "installed only on demand" and was always installed.
  `venn verify-plugin` promised to exit 1 when the shape is wrong and its whole
  verdict was that the plugin had a name and a namespace, which the loader had
  already required; it checks the actions, the matchers and the capabilities now.

  The rest are gone: `PluginDefinition.types` with the eight orphaned schemas that
  would have outlived it, `PluginDefinition.version`, `ctx.redact`, `toGraph`,
  `runStatements`, `never`, and five port descriptors nothing bound. `toGraph` is
  worth naming: on a four-construct program it produced five nodes and one edge,
  silently dropping the `else` branch, `run`, `try`, `match` and the whole
  fragment, and the companion it was sold beside has no implementation anywhere.

  **Breaking for a published package.** `PluginDefinition.version` was required, so
  a plugin literal outside this repository stops compiling until the line is
  removed; nothing ever read it. `PluginDefinition.types`, `ctx.redact` and the
  five descriptors go the same way, and `@venn-lang/fmt`'s renderers take the
  language's writer now rather than each keeping their own.

  That last one is the smaller half of a real defect: `[{ took: 250ms }]` rendered
  as `250ms` through `fmt.table` and interpolation and as `{"kind":"duration",
"ms":250}` through csv, yaml, xml and json, and a regex or a task rendered as
  its own internals, `"compiled":{}` and `"promise":{}` included. Six surfaces,
  one answer.

### Patch Changes

- Updated dependencies [[`d272818`](https://github.com/venn-lang/venn/commit/d272818687f122e5f6a40a3be565f0cb0e4a1910), [`18e17f9`](https://github.com/venn-lang/venn/commit/18e17f939db96ff45a8a2336069ffeeab75c055e), [`4c1eac1`](https://github.com/venn-lang/venn/commit/4c1eac1e18717cf39b5f7d75aa596c52f31a7457), [`902dd90`](https://github.com/venn-lang/venn/commit/902dd906f630e28a46e2ef530766d53fcf5cbe6e), [`d39bace`](https://github.com/venn-lang/venn/commit/d39bace59fb888f519f553a29e4c342db6ab0afa), [`aca64bc`](https://github.com/venn-lang/venn/commit/aca64bc5338e4a78e0835e44bd894a56519cff0e), [`8d448a9`](https://github.com/venn-lang/venn/commit/8d448a992d10cacfffb09a08f44fa04e540d46b4), [`d0915ca`](https://github.com/venn-lang/venn/commit/d0915ca3b941233265e804268ff31cfffb468644), [`eba6e01`](https://github.com/venn-lang/venn/commit/eba6e011d3f311e23e5958fc264b99c6b4acf28e)]:
  - @venn-lang/sdk@0.7.0
  - @venn-lang/types@0.7.0

## 0.6.0

### Patch Changes

- Updated dependencies [[`5fe5dcd`](https://github.com/venn-lang/venn/commit/5fe5dcd265374e8bf5ff7fbfebfd26b4c2930ffe)]:
  - @venn-lang/sdk@0.6.0
  - @venn-lang/types@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies []:
  - @venn-lang/sdk@0.5.0
  - @venn-lang/types@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [[`e12a24d`](https://github.com/venn-lang/venn/commit/e12a24d8f81d38568f4d66a7a2b16d4aa9b5ca10)]:
  - @venn-lang/types@0.4.0
  - @venn-lang/sdk@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies []:
  - @venn-lang/sdk@0.3.0
  - @venn-lang/types@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies []:
  - @venn-lang/sdk@0.2.0
  - @venn-lang/types@0.2.0

## 0.1.3

### Patch Changes

- Updated dependencies []:
  - @venn-lang/sdk@0.1.3
  - @venn-lang/types@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies []:
  - @venn-lang/sdk@0.1.2
  - @venn-lang/types@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies []:
  - @venn-lang/sdk@0.1.1
  - @venn-lang/types@0.1.1

## 0.1.0

### Patch Changes

- Updated dependencies []:
  - @venn-lang/sdk@0.1.0
  - @venn-lang/types@0.1.0
