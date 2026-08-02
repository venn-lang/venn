---
"@venn-lang/core": minor
---

A fragment checks what it is handed.

```venn
fragment show(s: string) {
  print s
}

run show(42)          # VN3010 · Type mismatch: expected string, found number
run show()            # VN3010 · `show` takes 1 argument, and 0 were given
```

A `fn` called with the wrong type has been refused for as long as there have
been types. A `fragment` was not: `run` handed over whatever it was given and
the parameter's annotation was read by nobody, so the one construct written to
be called from elsewhere was the one nothing checked. Neither the types nor the
number of them.

The mismatch is reported at the argument, the way a call's is, and a nullable
handed to a plain parameter is refused with the same help under it.

A parameter that says nothing still takes anything, and a fragment this file
does not declare is left alone: one imported from elsewhere is resolved by the
runtime, and a name nobody declares at all is `VN2005`.
