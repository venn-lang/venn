---
"@venn-lang/core": minor
"@venn-lang/runtime": minor
---

Let a pattern take what is left with `...`.

```venn
const { id, ...body } = order      # body is the Order without its id
const [first, ...rest] = xs        # rest is a list of the same thing
```

The type follows: the rest of a shape is that shape without the fields that came
out of it, so reading one of them off the rest is a mistake where it is written.
The rest of a `map<V>` is still a `map<V>`, since taking keys away changes how
many there are and not what they hold.

It works wherever a pattern does, a `match` arm included.
