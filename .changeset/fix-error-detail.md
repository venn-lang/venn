---
"@venn-lang/cli": minor
"@venn-lang/lsp": minor
---

The rest of what an error knows now reaches the person reading it.

```
VN2018 · Nothing is named "descnto" here.
  at    cart.vn:2:12
  help  Did you mean `desconto`?
```

§16 says a well-formed error answers seven questions. Two arrived. `help`,
`note`, `related` and `docs` were built by the checks and dropped by the
renderer:

```ts
process.stderr.write(`${problem.code} · ${problem.title}\n`);
process.stderr.write(`  at ${uri}:${line}:${column}\n`);
```

Eighteen places in the checker fill one of those fields. `VN2007` says which
import to write, `VN3013` says to use `run`, `VN2018` and `VN2003` name the
verb or the binding that was nearly right, and none of it was shown.

One renderer now, so `venn check`, `venn run` and `venn test` read the same
beneath their own headings, and the editor carries the help into the diagnostic
it publishes rather than only the title.
