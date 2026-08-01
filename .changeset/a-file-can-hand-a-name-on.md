---
"@venn-lang/core": minor
"@venn-lang/runtime": minor
---

`pub import` publishes what it brings in, which it has parsed and ignored until
now.

```venn
# lib/cart/mod.vn
pub import { total } from "./total.vn"
pub import * as coupon from "./coupon.vn"
pub type Item = { sku: string }
```
```venn
import * as cart from "./lib/cart/mod.vn"
cart.total(items)
cart.coupon.apply(t, code)
```

The grammar carried the `pub` on an import since imports were written, and
nothing read it. A file that trusted it published nothing, and the failure
arrived wherever the name was used.

It travels by value and by type, under whichever name the handing file gave it,
through a wildcard, and further than one hop. What is not marked stays private.

What a module offers is now asked in one place, since three readers needed the
same answer and each worked it out separately: the binder, the type checker, and
the check that refuses an import of a name nobody published.
