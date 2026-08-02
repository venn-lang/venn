---
"@venn-lang/core": minor
"@venn-lang/runtime": minor
"@venn-lang/cli": minor
---

The lint family has six codes, and had one.

Each of these runs and does something other than what it looks like. None is a
syntax error and none is a type error, which is why nobody was saying anything.

| Code | Written | What happened |
| --- | --- | --- |
| `VN5002` | `print { a: 1 }` | prints an empty line: the trailing map is options |
| `VN5002` | `print match x { … }` | prints an empty line: that is two statements |
| `VN5003` | `{ a: 1, a: 2 }` | the second wins, in silence |
| `VN5004` | `on banana { … }` | an event nothing fires, so a block nothing runs |
| `VN5005` | an import nobody used | a hint, since it is untidy and not wrong |

`VN5001` reaches both words it is for. `capture` was parsed inside a flow and a
parse error at the top of a file, where a program has its bindings; `while` had
no rule at all, so it was `Expecting token of type 'EOF' but found 'while'`
wherever it was written. Both now say what became of the word and what to write.

An error is reported before a hint, and `venn check` no longer fails on a hint
alone.
