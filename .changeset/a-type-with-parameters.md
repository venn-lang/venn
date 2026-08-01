---
"@venn-lang/core": minor
---

`type Box<T>`: a name whose shape is finished by whoever uses it.

```venn
type Box<T> = { held: T }
type Pair<A, B> = { left: A, right: B }

const caixa: Box<string> = { held: "x" }
```

Generics were usable and not declarable. `list<number>` written by a plugin
worked, and nothing a person wrote in Venn could be generic, so every container
written here was either one type or `dynamic`.

A value that does not fit what was filled in is refused naming both sides:
`Box<string>` with `{ held: 1 }` says `expected { held: string }, found
{ held: number }`.

A `fn` gets no type parameters, and needs none: inference generalises one
already, so `fn first(xs) => xs[0]` is used at two element types without saying
so. Only a `type` names them, because only a `type` has no body to infer from.

A generic crosses a file boundary as a generic. Filling its parameters to make
it a type would have made an imported `Box<string>` accept anything.
