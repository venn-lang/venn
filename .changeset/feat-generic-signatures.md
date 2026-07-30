---
"@venn-lang/core": minor
"@venn-lang/data": minor
"@venn-lang/runtime": minor
"@venn-lang/types": minor
---

Let a signature be polymorphic, and type what a list and a map give back.

`t.param("T")` publishes a type parameter, so a plugin can say it gives back what
it was handed: `data.oneOf("a", "b")` is a string and `data.shuffle([1, 2])` is
still a `list<number>`.

The built-in members follow. `groupBy` gives a `map<list<T>>`, `keyBy` a
`map<T>`, `countBy` a `map<number>`, and `flatten`, `toMap`, `zip` and `unzip`
carry their elements through instead of answering `dynamic`. `map<V>` is a type
a value is checked against rather than a name that meant nothing.
