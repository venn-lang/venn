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

Five things a program could not see: where a project ends, whose randomness a
flow draws, what a call is shaped like, what the tarball carries, and what the
READMEs teach.

**The upward walk stops at the drive root.** Three packages held a copy of it
and the three disagreed about where a Windows path ends. `parentOf("c:")` found
no slash and answered with the empty string, so an absolute walk fell off the
drive root into a relative step, and a relative step is whatever directory the
shell was standing in: an isolated file ran with a stranger's `[env]`, a
stranger's `[paths]` and a `rootDir` of `""`, and said nothing. `contracts` now
holds the one walk under one rule, an absolute walk never yields a relative
step, and the editor's twelve-directory cap is gone with the other two copies.
A file outside every project now reports VN2101 where it used to run.

**A flow's generated values are the flow's.** `data.*` drew from a mulberry32
held at module level, one per process, which no host could seed and nothing
ever reset, so what a flow generated depended on which flows ran before it and
`--flow` changed the answer. `Random` gains `restart`, the runner hands the
stream back at the start of every flow, and `data.*` draws from it like `math.*`
does. `mock` kept its flags, interceptors and frozen clock the same way, and
`mock.clock.advance` read the instant back: a plugin now says what it keeps with
`atFlowStart`.

**A call's arguments are counted.** Nothing looked at the shape of a call, so
`http.get()` and `http.get 42` both checked clean and a verb could disagree with
its own declaration for a release. VN3002 refuses more positional arguments than
a verb takes and fewer than it needs. Then the declarations that were wrong:
`auth.hmac` and `browser.press` declared their two arguments backwards, `header`
declared a value it never compared, `io.write` and `io.eprint` took every
argument and declared one, and `mock.clock.advance` read an option no schema
declared. A trailing map is decided by the options a verb declares rather than
by counting, so `mock.respond(201, { body })` is the call `mock.respond 201
{ body }` always was.

**The shipped binary carries what it loads.** `@venn-lang/dts` was bundled out
of the tarball, which is unpacked with no install step, so `venn add` ended in a
Node stack trace for everybody who installed the documented way, after the
manifest was edited and the lock written. The compiler ships in a chunk of its
own, off the `venn run` startup path, and a build that still cannot reach it
prints VN2108 and finishes the command.

**Every Venn block in a package README checks.** Twenty-one were refused;
eighteen were the documentation and are fixed, one was the harness's manifest,
and three are catalogues and illustrations that now carry an opt-out saying why.
`use` is gone from the prose, from `venn fmt`'s header rule, and from the
diagnostic: `use http` says what happened to the word.
