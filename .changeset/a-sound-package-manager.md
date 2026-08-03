---
"@venn-lang/cli": patch
---

A package manager that installs, and a scanner that cannot be made to hang.

`pnpm@11.13.0` was unpublished as a broken release: its `@pnpm/exe` build shipped
without a binary, so every job began by failing to install the tool it needed.
The pin moves to `11.20.0` and the lockfile does not change, so nothing was
resolving differently, only refusing to start.

The examples scanner matched a decorator line with `@\w+[^\n]*`, whose two halves
overlap: a line of `@` and then anything can be split between them in as many
ways as the line is long. It reads every example, which is exactly where that
costs something. `@[^\n]+` says the same thing with one way to match it.
