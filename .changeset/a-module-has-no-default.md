---
"@venn-lang/runtime": minor
---

A default import from a `.vn` module is refused rather than left holding nothing.

```venn
import lib from "./lib.vn"
```

```
VN2009 · A `.vn` module publishes by name, so it has no default.
  help  Write `import { lib } from "./lib.vn"`, or `import * as lib` for the whole of it.
```

The spelling is not dead syntax: a package has a default export and the binder
reads it. A module is the opposite case, publishing by name with `pub` and
having no default at all, so the field was never read.

A package that has no default export is now the same diagnostic, instead of a
binding of nothing.
