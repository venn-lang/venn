---
"@venn-lang/core": minor
"@venn-lang/lsp": minor
---

Remove three rules that parsed and did nothing.

`factory`, `dataset` and `report` were in the grammar, passed `venn check`, and
were read by no runtime. The name each one bound held nothing, so whatever used
it failed three lines later as `undefined`:

```venn
factory u { a: 1 }
print u                # undefined, and the file checked clean
```

Outside the AST helpers they appeared only in the language server's highlighter,
which coloured a keyword that did nothing.

Dead syntax is worse than absent syntax: absent syntax fails at the line that
wrote it. Nothing in the repository used any of the three. If test data or
per-file reporters are wanted, they come back designed, with a runtime and a
checker behind them, and the specification describes them the day they work.

`VN8002_LOOP_LIMIT` goes with them, from the other direction: it was catalogued
and raised by nothing, because `loop` is deliberately uncapped.
