---
"@venn-lang/contracts": minor
"@venn-lang/sdk": minor
"@venn-lang/core": minor
"@venn-lang/runtime": minor
"@venn-lang/project": minor
"@venn-lang/toolchain": minor
"@venn-lang/lsp": minor
"@venn-lang/cli": minor
"@venn-lang/data": minor
"@venn-lang/mock": minor
"@venn-lang/auth": minor
"@venn-lang/http": minor
"@venn-lang/io": minor
"@venn-lang/db": minor
"@venn-lang/date": minor
"@venn-lang/browser": minor
"@venn-lang/stdlib": patch
---

The rest of epic #289: three bugs and two catalogues.

`findProject` walked past the drive root and adopted whatever project the shell
happened to be standing in, and it was not only `env` that decided: `[paths]`
came with it, so an isolated file resolved its aliases against a stranger's
manifest. One upward walk lives in `@venn-lang/contracts` now, under one rule,
that an absolute walk never yields a relative step. The third copy of it in the
editor also carried a twelve-directory limit, so a project root thirteen levels
above an open file was invisible there and visible to the command line.

The shipped CLI could not load `@venn-lang/dts`, so `venn add` died with
ERR_MODULE_NOT_FOUND for anybody who installed the documented way. It is bundled
now, as a chunk of its own that only the command deriving types opens, and a
guard recreates the shipped layout and runs the binary in it, because reading the
build config is what let this survive.

Every `data.*` value came from a process-global generator no host could seed, so
a flow's values depended on which flows ran before it. `Random` gains `restart()`
and a flow restarts it, so the same seed gives the same values whatever ran
first, and `createNodeHost({ seed })` lets a host replay a run.

A verb or a matcher handed more positional arguments than it takes, or fewer than
it needs, is now refused with VN3002. Fixing that turned up declarations that
were simply wrong: `auth.hmac` and `browser.press` had their two arguments
backwards, and several verbs declared as required what their bodies read by name.

And twenty-one Venn blocks across fifteen package READMEs did not check. They do
now, and the guard's list of tolerated refusals is empty.
