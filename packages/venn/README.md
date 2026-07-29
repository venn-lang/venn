# @venn-lang/venn

> The `venn` binary: works out which version of the language a directory wants, installs it if it is not there, and hands the command over.

```bash
npm install -g @venn-lang/venn
```

That installs about 90 KB and no compiler. The language is a thing this fetches
and keeps, one directory per version, so two projects on the same machine can be
on two versions and neither has to know.

```bash
cd my-suite
venn test
# venn: installing 0.1.3
# ✓ 4 passed
```

The first command on a machine with nothing fetches a version first and says so.
Every one after that starts in about 200 ms.

## What decides the version

A `venn.toml` that pins one, a `.venn-version` file, or the version chosen as
the default. All of it, including ranges like `0.2.x` and `>=1 <1.5`, is
[`@venn-lang/toolchain`](../toolchain), which answers the question without
touching anything.

```toml
[package]
venn = "0.2.x"
```

`VENN_HOME` says where versions live, if `~/.venn` is not where they should go.

## Handing over

Spawned, not linked. A symlink on Windows needs a privilege that is not always
granted, and a shim rewriting `PATH` is a thing to debug on somebody else's
machine.

The terminal itself is handed over rather than piped, so a test run prints as it
goes, anything reading input reaches the language, and the language still knows
it is talking to a terminal and can use colour.

What survives the handover:

| | |
| --- | --- |
| the exit code | CI reads it, and a run killed by a signal reports 128 plus the signal rather than 0 |
| the streams | unbuffered, in both directions |
| Ctrl-C and the rest | forwarded, so a supervisor stopping this stops the language too |

## It carries no compiler, and that is checked

`carries-no-language.mjs` fails the build if this package depends on anything
but `contracts` and `toolchain`, if any source file imports the language, or if
the built binary grows past 512 KB.

One convenient import of something from `@venn-lang/core` would pull in the
parser, the runtime and the standard library, and the binary would quietly go
back to being what it was. Nobody notices a package getting slowly larger, which
is why a build that does it fails instead.
