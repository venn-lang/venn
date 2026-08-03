---
"@venn-lang/contracts": minor
"@venn-lang/core": minor
"@venn-lang/project": minor
"@venn-lang/runtime": minor
"@venn-lang/stdlib": minor
"@venn-lang/lsp": minor
"@venn-lang/cli": minor
---

One front end, so a pass added once reaches every command.

Parse-and-check was assembled by hand in three places, each choosing its own
subset of the passes. `venn run` and `venn test` never type-checked, so this ran
clean and printed `seven`:

```venn
const count: number = "seven"
print count
```

`venn check` refused it. Both refuse it now, and so does `venn build` and so
does the editor, because all four call the same `createFrontEnd({ plugins, caps
}).analyze(…)` in `@venn-lang/runtime`. What a command decides is still its own:
`venn run` reports errors only, `venn check` prints hints and exits 0, the editor
draws each at the severity the catalogue declared. Which passes ran is no longer
a choice anybody makes.

What that closes on the way past:

- an error inside `${…}` is reported at the `${…}`. Every one used to land at
  line 1, column 30, whatever the file said, because a placeholder is parsed as
  its own little document and three copies of "where is this node" answered from
  its offsets.
- a name nothing binds inside `${…}` is the same `VN2018` it is outside one.
  `expect "id=${noSuchName}" == "id="` used to pass.
- the editor reports `VN2009` for a name a package does not publish, with the
  note that says what to write instead; keeps the severity the catalogue
  declared, so an unused import is a hint and not a red line; carries the other
  place a problem is about, which a client renders as a jump; and types a value a
  plugin publishes.
- `print` inside a flow reaches stdout under `venn test`. There is no console in
  `stdlibPortBindings` any more, so a host that forgets to bind one hears
  `VN7002` instead of writing into a buffer nobody drains.
- one answer to what a project declares, dotenv files included, shared by every
  command. A token kept out of the repository used to fail the check and run
  fine.
- a file inside a workspace member reads what its root declared. The editor took
  the first `venn.toml` it found and used it verbatim, so every root-declared
  `env.*` was a red squiggle and every `#alias` pointed nowhere.
- `pub const`, `pub type`, `pub namespace` and `pub import` can be completed
  inside `import { }`, which only `pub fn`, `pub fragment` and `pub deco` could.
- `venn build` exits by the rule `venn check` exits by: a hint is not a failure.
