---
"@venn-lang/core": minor
"@venn-lang/runtime": minor
---

Let a match arm be reached more than one way, written with `|`.

```venn
match res.status {
  200 | 201 | 204 => "ok"
  400 | 404       => "the request"
  _               => "the server"
}
```

Coverage counts every way, so two of them together complete a union. Each way
binds for itself, read against the branches that way alone can be, and every way
into an arm has to name the same things: which one matched is not knowable there,
so a name only some of them bind could not be read by the body.
