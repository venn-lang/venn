---
"@venn-lang/core": patch
"@venn-lang/runtime": patch
---

A decorator's hook runs in the program, so a decorator can do something.

```venn
deco cooldown(target: Fn, times: number) {
  let calls = 0
  target.wrap(fn (call, args) {
    calls = calls + 1
    if calls > times { fail "on cooldown" { code: "cd" } }
    call(args)
  })
}
```

Every line of that was refused. `VN2016` for the `fail`, `VN2023` for a name at
the top of the file, and `VN3021` at the call site for the counter, which
`venn check` had passed clean.

A `deco` body runs at expansion and cannot reach the world. That is right and it
stays. A hook is not the body: `target.wrap(fn (call, args) { … })` hands a value
over, and the value is called once the program is running. The rule asked
**where** a call was written rather than **when** it runs, so it answered about a
moment the hook was not in.

Three boundaries moved and one did not.

**The checker stops at a hook.** `enclosingDeco` walks out to the `deco`, and now
stops at the lambda in between, so the document's ordinary checks apply inside a
hook and a plugin verb written there is not refused.

**The reach check stops at a hook.** A name read inside one is the program's to
answer, so a hook reads a top-level `const` and calls a top-level `fn`. What the
body itself reads is still refused, with the same sentence and span.

**A hook is re-seated where both halves exist.** It closed over the `deco` body
and needs the program too, and the first moment both are in hand is where the
runtime binds the decorated function. `HookEnv` puts the body first and the
program behind it, so a decorator's own name wins over one the file happens to
share.

State follows from the same place. A `deco` body keeps its bindings in cells, so
a hook writes what it reads: a counter in the decorator, or one in the file that
two decorations share. The body's storage is deliberately not called `cell`,
because an environment that answers `cell` is read as the end of the chain and
every free name would take an empty one minted at expansion and never ask the
program again.

What did not move: a verb or a top-level name written in the `deco` body itself
is still refused, and `known-gaps.md` entries 23 and 24 close.
