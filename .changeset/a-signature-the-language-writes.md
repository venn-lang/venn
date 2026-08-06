---
"@venn-lang/lsp": patch
---

A `fn`'s hover is spelled the way the language spells it.

```
pub fn scoreOn(entry, stat): fn(Entry, string) -> number
```

That is one function, said twice. The parameter list on the left has the names
and no types, the type on the right has the types and no names, and the colon
between them reads as a return: a function taking two arguments looked like one
handing a function back.

```
pub fn scoreOn(entry: Entry, stat: string) -> number
```

Which is the line in the file. Names come from the declaration, types from the
checker, paired by position and rendered together so a variable appearing twice
gets one letter in both. A parameter the checker knows nothing about keeps its
bare name rather than being labelled `dynamic`, and a parameter the parse has no
name for shows as `_`, because dropping it would misalign every type after it.

The new spelling is also shorter than the old one, which repeated the parameter
list and wrapped the whole thing in `fn(…)`.
