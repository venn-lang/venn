# @venn-lang/venn

> The `venn` binary: works out which version of the language a directory wants, installs it if it is not there, and hands the command over.

```bash
npm install -g @venn-lang/venn
```

That installs about 100 KB and no compiler. The language is a thing this fetches
and keeps, one directory per version, so two projects on the same machine can be
on two versions and neither has to know.

A `postinstall` fetches the newest version so the first command does not wait.
It is only an optimisation: `--ignore-scripts` is ordinary practice, and this
repository uses it in five places of its own CI, so nothing depends on it having
run. With scripts ignored the first command fetches the language and says so,
and the second one starts immediately. Either way `npm i -g` leaves a working
`venn`, and a registry that could not be reached during install is not a reason
for the install to fail.

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

## Managing versions

```bash
venn version list                    # what is here, and which one this directory uses
venn version install latest          # or a version, or a range
venn version use 0.2.x               # pin this directory
venn version use 0.2.4 --global      # the answer for everything that does not ask
venn version remove 0.1.0
```

Everything else `venn` is given goes to the language untouched, so `venn
install` and `venn remove` keep meaning dependencies. Nothing a project already
scripts changes.

`list` marks the one in use and says what decided it:

```
* 0.1.1
  0.1.3

Using 0.1.1, as asked, pinned by /work/api/.venn-version
```

### What it refuses

Removing the version this directory is pinned to, or the one set as the default.
Both leave someone unable to run anything and finding out at the next command,
so each is refused with the way out of it named.

`use` writes a `.venn-version` file rather than editing a `venn.toml`. A
manifest is under review and belongs to whoever wrote it, and a command that
rewrites one shows up in somebody's diff unannounced. A project that wants the
pin in its manifest can put it there by hand, and it wins over the file.

`use --global` resolves a range to one version before writing it. The default is
the answer for everything that did not ask, and an answer that moves when
something else is installed is not one.

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
