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

It lives in the CLI rather than beside either evaluator because the cases are
files on disk, and the CLI is the package the charter lets read one. Nothing
here is shipped: `corpus/` is outside `src` and outside `files`.

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

## What has no case

`constructs-baseline.json` is every construct of the grammar that no case
writes. The list comes from the grammar itself, through the AST reflection
Langium generates, so a rule added to `venn.langium` appears in it with no edit
anywhere and fails by name in the commit that adds it. It only shrinks: a
construct that gains a case has to leave the file, which is a line in a diff
somebody reads.

A case counts as writing a construct when a node of that kind sits inside the
case's own body. Inside, because the four wrappers write `run`, `fragment`,
`fn`, a `let`, a `return` and a call of their own, and crediting those to the
bodies would certify fourteen constructs nobody wrote. Matching the keyword in
the text cannot do it either: `#` opens a comment, so a header saying "no `try`
case yet" would satisfy a `try` rule for ever, and every keyword is a legal
member name, so `res.try` holds one too.

The unit is the construct and not the construct in each placement. Eleven
statements a `fn` refuses, and two of those a file refuses as well, so a case for
one of them says which placements it is not legal in and why, in its own
`excludes` header.

## Running it

`pnpm --filter @venn-lang/cli test` drives every case and compares it with
`expected.json`, which is the pinned answer per case per placement. Agreement
between placements is not enough on its own, because both paths can be wrong the
same way: `match` dispatched on nothing at all in both, identically, for as long
as it existed.

`VENN_WRITE_CORPUS=1 pnpm --filter @venn-lang/cli test` records what the tree
does now, the way `node scripts/examples-run.mjs --write` does, and `pnpm format`
after it puts the file back the way Biome wants it. It writes
`constructs-baseline.json` too. The comparison is over the parsed answers, not
the text, so the formatting of the file is nobody's business but Biome's. Every
change to `expected.json` is a reviewed diff, and one nobody can explain is what
it is for.

An answer holds what the body printed, what running it refused with, and every
problem the front end found as `CODE severity@column title`. The sentence is
compared, not only the code: the charter makes a title the product's voice in
the user's own domain, and a message that changed to something wrong read here
as no change at all.
