---
"@venn-lang/core": patch
---

A function written in Venn can be called from JavaScript.

```venn
import { map } from "lodash"
print map([1, 2, 3], fn (n) => n * 2)
```

```
[false, false, false]
```

No error, no diagnostic, three wrong numbers. `[2, 4, 6]` now.

`nativeFn` wraps a host function so the language can call it, and nothing did
the reverse. A Venn callable is a `Closure`, a record the interpreter reads, so
a library handed one called it anyway and got whatever falls out of calling a
record.

Every `.map`, `.filter`, `.sort` and `.reduce` of every npm package was broken
this way, and so was every event handler, which between them is most of what a
program does with a library at all. The import worked, the value arrived, and
the answer was silently wrong.

## Structural, because a callback is often written inside something

`{ filter: fn (m) => … }` is the ordinary shape of an options object, so a plain
map and a list are walked rather than only the arguments themselves. Nothing
else is: a handle, a date, a regex is the host's already and crosses as it is.

A value carrying no callable is handed over **as itself**, never as a copy, so a
library that holds one and reads it back gets the object it was given.
