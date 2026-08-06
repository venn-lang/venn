---
"@venn-lang/lsp": patch
---

A type you declared answers in the editor.

```venn
## One row of the sales ledger.
type Sale {
  seller: string
  amount: number
}

const sales: list<Sale> = []
```

Hovering `Sale` did nothing, at the declaration and at the use, and Ctrl+Click
landed nowhere. Three readers each missed it for their own reason:

- `declaredName` knew a `let`, a `fn` and a parameter, so the declaration drew
  nothing.
- `typeNameHover` knew the built-ins, the seven decorator handles, and the types
  a plugin publishes, and that last one requires a dot, so a bare name fell
  through every branch.
- `resolve` handled `run`, `@deco`, a `Ref` and an import, and a type name is
  none of those.

Completion already offered these names, which is what makes it a defect rather
than a gap: the editor could name the type while it was being typed and then had
nothing to say about it once it was there.

The card is the declaration as it was written, cut after fourteen lines. A
`type` is already the description of itself, and rendering it a second way would
be a second description to keep in step, with the one the editor shows being the
one nobody edits. The declaration and the use draw the same card for the same
reason.

Lookup is its own namespace rather than an entry in the value table: `type Sale`
and `let Sale` can both be written in one file, and one table would resolve a
value reference to a type as readily as the other way round.
