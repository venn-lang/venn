---
"@venn-lang/core": minor
"@venn-lang/runtime": minor
---

Let a match arm ask for more than the shape.

```venn
match msg {
  { kind: "text", body } if body.len > 100 => "long"
  { kind: "text", body }                   => body
  _                                        => "other"
}
```

A pattern asks about shape and a guard asks about anything else, and what
separates them is what a failure does: the arm is passed over and the next one is
tried. The condition written in the arm body cannot do that, because by then the
arm has been chosen.

A guarded arm settles nothing. Its condition may fail, so it can never be the
reason a case is accounted for, and a match whose only arm for a branch is
guarded is still missing that case.
