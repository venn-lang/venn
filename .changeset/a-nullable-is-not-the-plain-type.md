---
"@venn-lang/core": minor
---

A nullable is not the plain type.

```venn
type User = { name: string | null }

const shown: string = u.name    # VN3010 · expected string, found string | null
```

`T | null` went wherever `T` was asked for and nothing was said, so the checker
knew a value might be nothing and never asked anybody to deal with it. A program
found out where it read a field of nothing, which is a failure at run time far
from where the null came in. It is refused now in a binding, an argument, a
return, a field and a list element.

Three ways out, and the mismatch says which:

```venn
const a: string = u.name ?? "anon"     # a value to stand in

if u.name != null {
  const b: string = u.name             # a guard, on the field
}
```

A guard on a field narrows the record it belongs to, because a scope binds names
and that is where there is somewhere to write down what was learned. Reading the
field afterwards reads the narrowed record.

A call that refuses an argument now says which argument, where it is written,
instead of printing two function signatures for the reader to line up and
invert.

`instant`, `duration`, `size` and `percent` are now names an annotation can
read. They were not, so `: duration` resolved to no declared type, which is
answered with `dynamic`, and all four accepted whatever they were given.
