# Known gaps

Places where the language, the specification and the implementation disagree.
Each is found by writing real code against Venn, not by reading it, and each is
kept here with the snippet that reproduces it.

Nothing here is ever a crash. They are things a user will reasonably try, and be
surprised by.

---

## The list is empty

Every entry this file held is closed. What they were, and where the answer now
lives:

| Was | Closed by |
| --- | --- |
| Nothing could carry state through a loop | `loop`, which binds state and carries it through `continue` (§06) |
| The specification promised syntax the grammar did not have | The raw string and the block string are in it, and a pattern is a `regex` value rather than a literal (§03) |
| Optional chaining failed the checker on a known shape | `?.` asks whether something is there, so "no" is an answer (§04) |
| `pub` covered only three declarations | It covers `fn`, `fragment`, `deco`, `type`, a binding and a `namespace` (§10) |
| A bare argument could not hold a binary operator | Kept, with `VN1002` saying which brackets to write (§04) |
| A `Type` decorator ran but could not type-check | Shape decorators run before anything is checked (§08) |
| Step titles did not interpolate | A title is filled against the scope it belongs to (§05) |

An empty list is not a promise. It means the ones found so far are answered, and
this file is where the next one goes: a gap belongs here the day it is found,
with the program that shows it, before anybody argues about whose fault it is.
