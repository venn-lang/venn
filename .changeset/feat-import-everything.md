---
"@venn-lang/cli": minor
"@venn-lang/core": minor
"@venn-lang/lsp": minor
"@venn-lang/prelude": minor
"@venn-lang/runtime": minor
---

**This breaks every file that says `use`.** Before 1.0 a break rides a minor
bump, which is the 0.x convention; the version to read it by is the changelog,
not the number.

Remove `use`, and bring everything in by name.

```venn
import { http } from "venn/http"
import { expect } from "venn/assert"
```

One keyword brings a namespace, a verb, a matcher, a type or a value into a
file, and nothing arrives unasked except the prelude. `use` parsed a whole
package in and left the file quiet about what it actually took, which is the
difference between reading an import and guessing one.
