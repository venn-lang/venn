---
"@venn-lang/core": minor
"@venn-lang/lsp": patch
---

Let `null` stand in a union: `string | null` parses, checks and narrows.

It is the type the language already built for `credits?: number` and the one the
hover offered as an example, and it could not be written: `null` is a keyword
rather than a name, so it never reached the rule that reads a type.

Comparing a name with `null` narrows it the way a discriminant does, so after
`if found != null` the value is there, and the branch where it is not says so.
