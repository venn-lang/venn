---
"@venn-lang/core": minor
"@venn-lang/runtime": minor
---

`VN2020`: a name bound twice in one file says so, and shows both.

```venn
import { json } from "venn/json"
const json = { parse: (x) => "mine" }

print json.parse("{}")     # "mine"
```

```
VN2020 · "json" is already the name of something in this file.
  at    main.vn:2:1
  help  Rename one of them, or bring the first in under another name with `as`.
  see   main.vn:1:1  `json` is bound here
```

The second one won and said nothing, so every `json.something` below it quietly
called the wrong thing. Two imports binding one name did the same.

Removing `use` was about a file saying what it takes, so a reader finds out
where a name came from by reading the top. A name that means one thing at the
top and another thirty lines down takes that back.

Only the top level: a name bound inside a function or a step is a local, and
shadowing is what a local is for.
