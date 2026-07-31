---
"@venn-lang/prelude": minor
"@venn-lang/core": minor
"@venn-lang/runtime": minor
"@venn-lang/lsp": minor
"@venn-lang/types": minor
---

One keyword brings things in, and everything that is not the prelude is imported
by name.

```venn
import { http } from "venn/http"          # the namespace, verbs hanging off it
import { http as h } from "venn/http"     # the same, under another name
import { contains } from "venn/assert"    # a matcher, by its own name
import { Request } from "venn/http"       # a type, to annotate with
import { User } from "./models.vn"        # values from another file
```

`use` is gone. It brought a package in and put whatever that package chose into
scope, under whatever name the package chose, which made the top of a file an
unreliable answer to where something came from. It still parses, and the checker
says what to write instead, with a quick fix in the editor.

What comes native now lives in `@venn-lang/prelude`: twelve names and one type,
described in the same wire format a plugin publishes. The kernel implements the
values, the runtime carries out the verbs, and tests hold all three against each
other.

`import { a as b }` works for files too, which it never did.
