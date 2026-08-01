---
"@venn-lang/runtime": minor
---

A verb a namespace does not publish is refused where it is written, wherever it
is written.

```venn
import { json } from "venn/json"
print json.pars("{}")
```

```
VN2003 · "json" does not publish "pars".
  Did you mean `json.parse`?
```

The statement form (`json.pars "{}"`) has been refused since `VN2003` existed.
The same mistake inside an expression reached nobody: the type of an unknown
verb is `dynamic`, so the checker had nothing to say, and the run failed a line
later with `This value is not a function, so it cannot be called: undefined.`

The registry already holds every verb of every namespace, which is where the
suggestion comes from, under whichever name the import gave the namespace.

A local binding of the same name still wins, as it does when it runs, and a
constant the namespace publishes is not reported as missing: `math.pi()` is
wrong for another reason and in another sentence.
