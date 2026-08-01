---
"@venn-lang/core": minor
"@venn-lang/runtime": minor
"@venn-lang/cli": minor
"@venn-lang/lsp": minor
---

`venn check` now refuses what `venn test` refuses.

```venn
@banana
flow "F" {
  step "s" { expect 1 == 1 }
}
```

```
venn check   ->  ✓ no problems found       exit 0
venn test    ->  VN2013 · No decorator is named "@banana".   exit 1
```

A checker that misses what the runner catches is worse than no checker: it is
the fast gate in CI and the thing the editor draws, and both said a file was
fine while the run refused it.

Two codes only expansion could raise. Both are now reported without running a
decorator body, which matters because the editor would otherwise execute plugin
code on every keystroke:

- **`VN2013`**, a decorator nothing provides, is a name lookup. It suggests the
  nearest decorator in reach, and a `pub deco` imported from another file counts
  as in reach.
- **`VN2017`**, a verb the handle does not have, reads a table. What each kind
  answers to is known before anything runs, so `target.wobble` is refused where
  it is written.

A test holds the relation, so a code cannot be added to one path only.

`DecoratorSource` gains `names()`: a source that can say whether it has one can
say which it has, and both questions have the same asker.
