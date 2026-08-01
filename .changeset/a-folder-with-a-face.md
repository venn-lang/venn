---
"@venn-lang/core": minor
"@venn-lang/cli": minor
"@venn-lang/lsp": minor
---

A folder is a module when it has a `mod.vn`.

```venn
# shop/mod.vn
pub import { withTax } from "./prices.vn"
pub import * as coupon from "./coupon"
```
```venn
import * as shop from "./shop"

shop.withTax(100)
shop.coupon.apply(100, "black")
```

**An extension names a file. No extension names a folder.**

| Written | Read |
| --- | --- |
| `"./cart.vn"` | that file |
| `"./cart"` | `./cart/mod.vn` |
| `"#lib/cart"` | `<paths.lib>/cart/mod.vn` |

No cascade: never "try `.vn`, then `/mod.vn`, then `/index.vn`". Whoever reads
the import knows from the string alone which of the two it meant, and there is
no resolution order to learn or to get wrong.

Before this, a library of ten files made its callers learn all ten paths. What
`mod.vn` hands on is the folder's interface, and what it does not is the
folder's business, which can be moved without a caller noticing.

A folder with no `mod.vn` is not a module, and the import that named one says
which file it looked for.
