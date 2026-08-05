---
"@venn-lang/lsp": patch
---

The editor follows a name through a folder's face.

```venn
# main.vn
import { order } from "./larder"
run order(one.item, one.gap) as line
```

```
VN2005 · Unknown fragment "order".
```

`venn check` was clean and the program ran. The editor underlined it anyway,
which is the one thing an editor must not do: there is no way to tell which of
the two is right.

`larder/mod.vn` is a face, three `pub import` lines and no declarations of its
own. Both readers stopped there. `declaresFragment` asked whether that file
declared `order`, and it does not, so `run` was told the fragment did not exist.
`resolveFragment` had the same defect wearing its fallback: it returned the
intermediate file with no declaration, so the hover read `fragment …` over
`mod.vn` instead of `pub fragment order(item, grams)` over `supplier.vn`. That
looks like a partial answer rather than a bug, which is why only the diagnostic
was ever reported.

The module graph was already walked transitively; only these two stopped at the
first hop. They now follow what a file hands on, through one rule they share,
because the alias is where a second copy would have gone wrong:
`pub import { order as pedido }` is `pedido` here and `order` in the file behind
it, so a walk that carried the outer name onwards stops one file too early.

A name no file behind the face declares is still refused, which is tested
alongside, since the way to pass the other two tests is to accept everything.
