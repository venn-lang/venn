---
"@venn-lang/core": minor
"@venn-lang/runtime": minor
---

A namespace can be written in Venn.

```venn
pub namespace coupon {
  const table = { black: 0.3 }         # private to the block
  pub fn apply(total, code) => total * (1 - table[code])

  pub namespace stacking {
    pub fn allowed(a, b) => a.kind != b.kind
  }
}
```

One could be published by a plugin or made by a file, and there was no way to
write one: a file that wanted to group two families of names had to become two
files, and a name that only makes sense beside three others sat at the top level
with everything else.

This is a fourth spelling of one thing rather than a fourth thing. `pub` decides
what leaves, exactly as it does in a module, so there is no second rule; what it
does not mark stays inside for the rest of the block, and is not on the value nor
known to the checker. It nests, and a `pub namespace` is published by its module
and arrives through `import`.

The checker gives it a record of what it published, so `coupon.applyy` is a
`VN3010` where it is written rather than a `null` somewhere later.

Reopening one another file declared is deliberately not among the three ways a
namespace comes to exist, and neither is replacing a verb in one. Removing `use`
was so a file says what it takes; a namespace a third file can add to puts that
back one level down.
