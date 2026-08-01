---
"@venn-lang/core": minor
"@venn-lang/runtime": minor
"@venn-lang/cli": minor
---

`VN2019`: an import whose path leads nowhere says so, at the import.

```venn
import * as cart from "./lib/cart"   # the file is ./lib/cart.vn
```

```
VN2019 · Nothing to import from "./lib/cart".
  at    main.vn:1:1
  help  Nothing was read at /app/lib/cart.
```

It used to say nothing at all. The namespace read as empty, every name off it
was absent, and the failure surfaced wherever it was used, blaming that. The
checker's own contribution was worse than silence: `VN3010 · Type {} has no
field "rate"`, which sends a reader to the field rather than to the path.

Two halves. The walk records what it tried and could not read, because only the
walk knows: whoever holds the graph afterwards sees an absent module and cannot
tell "not there" from "not looked at". And a namespace whose module was never
reached is now typed as unknown rather than as an empty shape, so nothing after
the import says it again, differently and wrongly.

That second half also removes an editor false positive: a neighbour the
workspace had not indexed yet was typed as empty, so every use of it was drawn
as a field error until the index caught up.
