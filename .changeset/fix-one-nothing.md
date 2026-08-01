---
"@venn-lang/core": minor
---

One nothing, so the guard everybody writes takes the right branch.

```venn
const data = json.parse('{ "a": 1 }')

if data.missing == null {
  print "this branch"       # it now runs; it did not before
}
```

`Value` holds `null` and not `undefined`, and equality is strict and converts
nothing. But a member nobody set, an index past the end of a list, and a name
nothing bound all produced JavaScript's `undefined`, which is not a `Value`. So
`data.missing == null` was **false** while `data.missing ?? x` gave `x`,
`typeOf` said `"null"` and `print` said `"undefined"`. Four answers to one
question, and `venn check` passed the file.

Absence is now `null` where it is produced: reading a member, reading an index,
and looking up a name. A property test holds that `undefined` never escapes into
a program.

The hot paths are untouched. A member that is there returns on the same branch
it always did, and a compiled local reads its slot with no check added, because
a slot only ever exists for a name the compiler already resolved.
