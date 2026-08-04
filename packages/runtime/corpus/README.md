# corpus

One body per file, run in each of the places the language compiles it.

The scheduler interprets statements; `@venn-lang/core`'s `compile/` turns a `fn`
body into slot-addressed thunks. Two implementations of one word is where the two
quietly disagree, so every case here is written once and driven four ways: at the
top of a file, inside a `fn` declaration, inside a `fn` expression, and inside a
`fragment`. The first and the last interpret; the middle two compile.

A case is statements only. It appends to `seen`, and the wrapper prints what
`seen` ended up holding, so the assertion is that the four answers agree and
nothing about the body has to be predicted.

## The header

Lines starting with `#`, before the body, and each one carries its reason:

```
# excludes fragment  a `namespace` is a declaration, and a fragment body holds statements
# differs  fnDecl    a pure body runs one pass at a time, so the option is refused there
# open     fnDecl    issue 264, a compiled pass reuses one slot so every closure reads the last
```

`excludes` leaves a placement out, because the body is not legal there.
`differs` says a placement is meant to answer differently, because the language
has a rule about it. `open` says a placement answers differently and should not,
and names the issue. The last two are opposites and are spelled apart on purpose:
a corpus with no word for a defect nobody is fixing today either goes red or,
worse, files that defect under "meant to".

## Running it

`pnpm --filter @venn-lang/runtime test` drives every case and compares it with
`expected.json`, which is the pinned answer per case per placement. Agreement
between placements is not enough on its own, because both paths can be wrong the
same way: `match` dispatched on nothing at all in both, identically, for as long
as it existed.

`VENN_WRITE_CORPUS=1 pnpm --filter @venn-lang/runtime test` records what the tree
does now, the way `node scripts/examples-run.mjs --write` does, and `pnpm format`
after it puts the file back the way Biome wants it. The comparison is over the
parsed answers, not the text, so the formatting of the file is nobody's business
but Biome's. Every change to `expected.json` is a reviewed diff, and one nobody
can explain is what it is for.
