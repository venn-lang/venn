---
"@venn-lang/json": minor
"@venn-lang/stdlib": minor
---

Read JSON text into a value.

```venn
import { json } from "venn/json"

type Order { id: number, total: number }
const order: Order = json.parse(res.body)
const maybe = json.tryParse(line)
```

Writing a value out has always been `fmt.json`. Reading one was missing, so a
response body, a fixture and a piped line were all text a program could print and
not use.

`parse` fails where it is written, naming the line and column, since an offset is
a number nobody can find in a file. `tryParse` hands that decision back with
`null`, because text that turns out not to be JSON is the everyday case rather
than a surprise. What comes back is `dynamic`: text says nothing about its own
shape, and the annotation is what gives it one.
