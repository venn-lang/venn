---
"@venn-lang/core": minor
"@venn-lang/runtime": minor
"@venn-lang/lsp": patch
---

Decide between the shapes a value can have, with every case accounted for.

```venn
fn describe(m: Message) -> string => match m {
  { kind: "ping", at }   => "ping at ${at}"
  { kind: "text", body } => "text: ${body}"
  { kind: "close", why } => "closed: ${why}"
}
```

The pattern is the one bindings already use, with one reading more: a name binds,
a literal tests. So an arm asks and names in the same breath, and a name on its
own asks nothing, which is what makes it the arm that takes the rest.

`=>` gives a value back and `{ … }` runs steps, the split `fn` and `flow` already
make: an arm written as steps has no value and cannot stand where one is wanted.
First arm that matches wins, with no falling through to the next.

It is the one construction that claims to enumerate, so it is the one asked to
cover: a case nobody wrote is VN3019 and an arm nothing can reach is VN3020,
while a subject that is not a set of branches is asked for nothing.
