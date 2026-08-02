---
"@venn-lang/fmt": minor
---

A table cell holding a map or a list now reads the way the language writes
it, not the way `JSON.stringify` does.

```venn
print fmt.table([{ name: "ada", marks: { homework: 95, final: 92 } }])
```

```
name │ marks
─────┼──────────────────────────
ada  │ { homework: 95, final: 92 }
```

was `{"homework":95,"final":92}` before: the host's shape, not the
language's. A table is written for a person to read, and `{ homework: 95,
final: 92 }` is what that person would have typed, the same text `print` and
`"${…}"` already give for the same value.

`fmt.json`, `fmt.csv`, `fmt.xml` and `fmt.yaml` are unchanged. They answer to
formats outside this language, and a CSV field written the Venn way would be
a broken CSV.
