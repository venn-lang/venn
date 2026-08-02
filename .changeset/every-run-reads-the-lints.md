---
"@venn-lang/cli": minor
---

`venn run` reads the lints too.

The document check ran under `venn check` and in the editor, and not under
`venn run`, so a lint was something you only met if you happened to ask twice.
`print { a: 1 }` was the worst of it: the check said the map had been swallowed
as an options block, and the run printed an empty line and said nothing.

Errors stop a run and are reported. A run already stops for a parse error and for
an import that names nothing, and a lint error is the same thing said later: a
line that cannot mean what it says. A warning or a hint stays `venn check`'s
business, because printing one on every run would teach people to stop reading
them.

It found two files in this repository on the first day, both importing a name
they did not use and using two they had not imported.
