---
"@venn-lang/runtime": patch
"@venn-lang/cli": patch
"@venn-lang/core": patch
"@venn-lang/mock": patch
"@venn-lang/stdlib": patch
---

The charter's rules are checked by something that runs, and the manifests say what the code uses.

`createRunner` is the runtime's entry point and showed nothing on hover: two
JSDoc blocks were stacked with nothing between them, so both bound to the
private helper underneath and the documented one was never the documented one.

Four workspace dependencies were declared and never imported, `@venn-lang/cli`
on `assert` and on `io`, `@venn-lang/core` on `contracts`, `@venn-lang/mock` on
`contracts`, and two more were production dependencies of `@venn-lang/stdlib`
that only its tests reach. None of them appears in any built bundle, so nothing
that installs these packages resolves less than it did.

Thirteen folders that hold TypeScript now publish a barrel, `cli/src/run` above
all, which fourteen files' worth of commands had been reaching into by name.
