---
"@venn-lang/sdk": minor
"@venn-lang/browser": minor
"@venn-lang/cli": minor
"@venn-lang/lsp": minor
---

Remove resources, which nothing opened.

`defineResource` and `PluginDefinition.resources` were SDK API. The `browser`
plugin filled the field with two, and said so itself:

```ts
/**
 * `open` hands back a placeholder handle and `close` does nothing, because the
 * runtime does not execute `resource` declarations yet.
 */
```

`buildRegistry` never read the field, the grammar has no `resource` declaration,
and the two mentions in the scheduler were comments describing something that
did not happen.

Holding something open across steps already has a spelling, and an explicit one:

```venn
const conn = db.connect url
defer {
  conn.close()
}
```

What a resource would have added over that is a shared lifetime: one browser per
worker, opened once, torn down in reverse order. Worth building the day there is
a real consumer to shape it, which the only one here was not.

The editor stops documenting three other things the language does not have
(`factory`, `dataset`, `report`), and `use` now hovers as removed with what to
write instead, the way `capture` already did.
