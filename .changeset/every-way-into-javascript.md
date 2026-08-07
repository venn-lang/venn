---
"@venn-lang/core": patch
"@venn-lang/runtime": patch
---

Every way of importing from JavaScript works, and the ones that cannot are said.

Four of the six ordinary spellings were broken, three of them in silence.

```venn
import { chunk } from "lodash"
print chunk([1, 2, 3, 4], 2)
```

`venn check` reported `✓ no problems found`. The run printed
`VN3013 · This value is not a function: null`, and a program that only read the
value carried the nothing on into arithmetic.

| | before | now |
| --- | --- | --- |
| `import { f } from "esm-pkg"` | bound, refused the call | works |
| `import { f } from "cjs-pkg"` | `null` | works |
| `import * as p` then `p.f()` on CJS | `Type {} has no field` | works |
| `import p from "cjs-pkg"` then `p.f()` | `null` | works |
| a name the package does not have | `null`, silently | `VN2009` |

## Four causes, one per symptom

**A host function was not callable.** `invoke` accepted a `Closure` or a wrapped
`NativeFn`, and an npm export is neither. It takes a bare function now, in the
one place a call is made, rather than wrapping at each binding site: wrapping
would hide what a callable package carries, and `lodash` is a function with the
whole library set on it.

**A CommonJS module has no named exports to bind.** Node hands an ESM namespace
of `{ default, "module.exports" }` and nothing else, so `chunk` was not found,
nothing was bound, and every read answered `null`. The names inside are opened
up, with the namespace winning wherever both have one.

**A member of a function answered `null`.** A function is neither a map nor a
handle, so the read fell through. It publishes what is set on it directly, and
never what it inherits: `call`, `apply` and `bind` turn any value into a
receiver of the reader's choosing, and `name`, `length` and `prototype` are the
engine's rather than the package's.

**A package with no types typed as `{}`.** `record({})` refused every member of
a namespace over a package like `lodash` that ships no types. Publishing no
types is the absence of an answer, not the answer that it is empty, so it reads
`dynamic` now, which is what the file beside it already said about a module that
could not be read.

## And the silence

A name no package publishes is `VN2009`, the same code a `.vn` module earns.
Both commands answer, from different evidence: `venn run` has the module, and
`venn check` reads the types `venn install` derived rather than importing a
package to ask about it, since importing runs whatever the package runs. A
package that published no types stays unknowable at check time and is left to
the run.

Typed packages were already checked and still are:
`nanoid(1, 2, 3)` earns `VN3002 · nanoid takes 0 to 1 arguments, and got 3`.
