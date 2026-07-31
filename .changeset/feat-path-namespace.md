---
"@venn-lang/contracts": minor
"@venn-lang/path": minor
"@venn-lang/runtime": minor
"@venn-lang/stdlib": minor
---

Joining a path, taking one apart, and asking where it leads.

```venn
import { path } from "venn/path"

const fixture = path.join(path.cwd(), "fixtures", name)
print path.stem(fixture)

if not path.isInside("uploads", requested) {
  fail "that name leaves the upload directory"
}
```

Every path in a Venn file used to be built by adding strings together, which is
how a program ends up with `a//b` on one machine and a backslash on another.

The separator is never an argument and never an answer: it belongs to the host.
`path.join("a", "b")` is `a/b` under the editor's worker and `a\b` on the machine
that runs it, and the program never says which, because the program is not the
one that knows. That is a new port, `venn.port.paths`, with an implementation per
spelling and a conformance suite both run: what they may disagree about is the
separator and what makes a path absolute, and everything else is asked of both.

A path that leaves the directory it was given is answerable before it is used.
`..` is worked out first, so a name that climbs out is caught wherever the climb
was written, and a directory whose name merely starts the same is a different
directory.
