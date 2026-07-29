---
"@venn-lang/cli": minor
"@venn-lang/venn": minor
---

The `venn` command moved to its own package. If you installed `@venn-lang/cli` from 0.1.x, move across in this order:

```bash
npm rm -g @venn-lang/cli
npm i -g @venn-lang/venn
```

Both packages want the name `venn`, and npm refuses to take a name another package holds, so installing before removing fails with `EEXIST`. Running the old `venn` after upgrading `@venn-lang/cli` prints these two lines rather than leaving you with a command that is gone.

Nothing you have written changes. `venn test`, `venn run` and the rest work as they did, on the version each project asks for.
