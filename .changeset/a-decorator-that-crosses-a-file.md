---
"@venn-lang/core": minor
---

Expansion now covers every file the import graph reached, not only the one being
run. A `@name` written above a declaration in an imported module takes effect
wherever that declaration is called from, which is what made decorators useful
in a program of more than one file. Pass the modules to `expand` as `modules`.

A name a `deco` body reaches for and cannot have is refused with `VN2023`, at
the place it is written, including one written inside a `${…}`. A decorator runs
before the program exists, so a top-level `const` has no value and a top-level
`fn` is not callable yet; that stays true, and reading one is now said out loud
instead of answering nothing and failing later somewhere else.
