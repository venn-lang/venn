---
"@venn-lang/runtime": patch
---

A fragment reads the file it was written in.

```venn
const limit = 7

fragment show() {
  print limit          # was null, is 7
}
run show()
```

Its scope was built from nothing, so the file's bindings were one link away and
out of reach, while a `fn` written beside it read them fine. Nothing caught it:
the name is bound in the file, so the check that asks about unbound names was
right to stay quiet, and what surfaced was an operator refusing two values a
line later.

A fragment belongs to its file the way a `fn` does. Its parameters and whatever
it binds still die with the call, and a caller's locals are still out of reach,
because the scope it gets is a child of the file and never of the caller. One
imported from elsewhere reads its own file, not the caller's.

Assigning one of the file's bindings from inside a fragment now writes the
file's binding.
