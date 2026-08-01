---
"@venn-lang/core": minor
"@venn-lang/runtime": minor
---

`VN2018`: a name nothing binds is said where it is written.

```venn
const total = 100
const desconto = 0.1

print (total * (1 - descnto))
```

```
VN2018 · Nothing is named "descnto" here.
  Did you mean `desconto`?
```

Before this, `venn check` passed the file and the run said
`Operator "-" cannot be applied to these values.`, which is true, useless, and
points at the operator rather than at the typo.

There was no code for it: the catalogue had one for an unknown action, an
unknown fragment, an unknown env key and a namespace nobody imported, and
nothing at all for a name that is not bound.

The check is deliberately blunt about scope. It asks whether a name exists
anywhere in the file, never whether it is in scope at the point it is read, so a
function that calls one declared below it is not reported. Scope is the harder
question and it is not the one a typo needs answering, and a diagnostic that is
wrong even sometimes is one people learn to ignore.

A bare name inside a decorator stays a word: `@tags(smoke)` names a tag, and a
decorator runs before there is a program for one to refer to.
