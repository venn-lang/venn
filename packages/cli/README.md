# @venn-lang/cli

> The `venn` binary: one command for starting, checking, running and testing a Venn project.

This is the only package that touches `node:*`. It builds the `Host`, binds the real
implementations behind every port (filesystem, HTTP client, HTTP server, console, spawn) and hands
them to the runtime. Everything below it (`@venn-lang/core`, `@venn-lang/runtime`, `@venn-lang/sdk`) stays
platform-neutral, which is why the same compiler runs in a Web Worker for the editor.

## Usage

```ruby
# tests/hello.vn
module demo.hello

use "venn/http"
use "venn/assert"

flow "Hello" {
  step "Ping" {
    let res = http.get "https://example.com"
    expect res.status == 200
  }
}
```

```bash
venn test tests/hello.vn
```

The repository is not published, so from a source checkout the binary is:

```bash
pnpm --filter @venn-lang/cli build
node packages/cli/dist/bin/venn.mjs test examples/
```

## Commands

| Command | What it does |
| --- | --- |
| `venn new <name>` | Start a project in a new directory |
| `venn init` | Start a project in the directory you are in |
| `venn add <pkg…>` | Add a dependency to `venn.toml` and install it |
| `venn remove <pkg…>` | Remove a dependency and install without it |
| `venn update` | Update what is installed, within the ranges asked for |
| `venn install` | Install what the manifest asks for |
| `venn build` | Check every target and record the build under `target/` |
| `venn run [target]` | Run a file as a program: its statements, top to bottom |
| `venn test [target]` | Run every flow in a file or folder as a test suite |
| `venn list [target]` | Print the flows and steps that would run |
| `venn fmt [target]` | Format `.vn` files in place |
| `venn check [target]` | Statically check without running |
| `venn verify-plugin <path>` | Inspect a plugin module and check its shape |

### Starting a project

```bash
venn new my-suite            # a program: venn.toml, src/main.vn, .gitignore
venn new my-lib --lib        # a library: venn.toml, src/lib.vn
venn new monorepo --workspace  # a root that owns members
venn init --name api         # the same, in the current directory
```

| Flag | Effect |
| --- | --- |
| `--bin` | A program with a `main`. This is the default. |
| `--lib` | A library: other packages use what it marks `pub`. |
| `--workspace` | A root that owns members, one lock and one `target/`. |
| `--dry-run` | Print what would be written and write nothing. |
| `--name <name>` | `init` only. Defaults to the directory's own name. |

A `.gitignore` is written only when the new package is not already inside a workspace, because one
`target/` per workspace means one line ignoring it, at the root that owns it. An existing
`venn.toml` is never overwritten: the command stops with `VN2102`.

### Dependencies

```bash
venn add zod                 # newest, pinned back into venn.toml as ^x.y.z
venn add hono@^4 -D          # a development dependency
venn remove zod
venn install --frozen        # refuse anything the lock did not record
```

| Flag | Effect |
| --- | --- |
| `-p, --package <name>` | Act on one workspace member. |
| `-D, --dev` | `add` and `remove`: the `[dev-dependencies]` table. |
| `--frozen` | `install`: check what is installed against `venn.lock` and fail on drift. |

`venn.toml` is edited first, then the package manager runs against a `package.json` generated into
`target/`. That ordering is what makes the manifest the source rather than a copy. Which manager
runs is `[tooling] manager` in the root manifest: `pnpm` (the default), `npm`, `bun` or `yarn`.

After a successful install the lockfile is written and the types each package publishes are derived
into `target/types/`. Each one reports a measured coverage line, `<name>: <pct>% of <n> exports
typed`, rather than a claim. Those files are what `venn check` reads to type an
`import { z } from "zod"`.

Names are validated before anything runs (`VN2105`). Under `--frozen` the lock is the input, not the
output: a missing lock is `VN2106` and any drift is `VN2107`, listed file by file.

### Running

```bash
venn run src/main.vn arg1 arg2
venn run --bin worker --env staging
```

`run` executes the file as a program. `test` runs its flows as a suite. Arguments after the file
reach the program as `io.args`.

A program that reached its last line is not asked to stop: a server that bound a port keeps
serving, and the event loop decides when the process ends. A program that said `exit N`, or that
ended badly, leaves at once, and whatever it opened is closed on the way out. The same closing runs
for a signal, an uncaught fault and an ordinary exit.

| Flag | Command | Effect |
| --- | --- | --- |
| `--bin <name>` | `run` | Which program, when the package has several. |
| `--env <name>` | `run`, `test` | The environment from `venn.toml`. Default `local`. |
| `-p, --package <name>` | all | Act on one workspace member. |
| `--reporter <name>` | `test` | `pretty`, `ndjson`, `dot` or `junit`. |
| `--flow <text>` | `test`, `list` | Only flows whose title contains this. |
| `--step <text>` | `test`, `list` | Only steps whose title contains this. |
| `--tags <a,b>` | `test` | Comma-separated `@tag` filter. |
| `--bail` | `test` | Stop after the first failing flow. |

### Checking

```bash
venn check .                 # resolve actions, matchers, imports and types
venn fmt src/                # format in place
venn fmt --check .           # report what would change and fail, for CI
venn build --release
```

`check` parses each file, resolves its imports, builds the plugin registry from the whole stdlib and
runs the type checker. Problems from every file are gathered and reported once. `fmt --check` exits
1 when anything would change.

`build` checks every target of the selected packages and writes `target/debug/build.json`, or
`target/release/build.json` with `--release`. There is no code generation yet and the record claims
none: it lists the targets covered, the files read and the number of problems. A build with problems
always fails; what the profile decides is whether the record is written anyway. `[profile.dev]` is
lenient by default and `[profile.release]` is strict, and either can set `strict` explicitly.

### verify-plugin

```bash
venn verify-plugin ./dist/index.mjs
```

Imports the module, takes its default export (or the first export that looks like a plugin) and
prints the name, the namespace and how many actions, matchers and resources it declares. Exits 1
when the shape is wrong.

## Targets: what a bare command means

A path given outright always wins and is never second-guessed. With no path, the nearest `venn.toml`
answers, walking up from the current directory; a workspace answers with its `default-members`, or
with all of them when it named none.

| Command | With no path |
| --- | --- |
| `venn test`, `venn list` | The `tests/` directory of each selected package |
| `venn run` | The package's single `bin` target, conventionally `src/main.vn` |
| `venn check`, `venn fmt` | Every `.vn` file the selected packages own |

Directories are walked recursively, sorted so runs are reproducible, skipping `node_modules`, `dist`
and `.git`. Nothing silently succeeds: no project is `VN2101`, an unknown `-p` name is `VN2103`, and
several `bin` targets with no `--bin` prints the names to pick from.

## Reporters

| Name | Output |
| --- | --- |
| `pretty` | A live tree: a banner per file, a branch per flow, a verdict per step, then every failure repeated at the end with its `VNxxxx` code and source location. |
| `ndjson` | One event envelope per line on stdout. |
| `dot` | One character per assertion, then a summary line. |
| `junit` | A JUnit XML document, emitted on `run.finished`. |

With no `--reporter`, a terminal gets `pretty` and anything piped gets `ndjson`, so scripts and CI
keep a stream they can parse.

## Environments

`--env <name>` selects an environment, `local` unless told otherwise. Variables come from three
places, lowest precedence first:

1. `[env.<name>]` in `venn.toml`, the documented default, committed.
2. The dotenv files, in order: `.env`, `.env.<name>`, `.env.local`, `.env.<name>.local`, or whatever
   `[env] files` lists instead.
3. The environment the process was started with.

The real environment wins, because that is how CI passes a token in. It overrides rather than adds:
a name has to be declared in one of the first two places for the third to fill it, which keeps
`PATH` and `TEMP` out of the editor's completion. A value that exists only in CI is read through
`secrets.*`, which needs no declaration and redacts what it returns.

The manifest that governs a file is found by walking up to the project the file belongs to, not by
reading whatever sits in the same folder, so `venn test packages/api/tests/login.vn` sees the same
environments and `[paths]` aliases as running it from inside `packages/api`.

## API

The package also exports the seam the commands are built on, for embedding a run in another program.

| Export | What it is |
| --- | --- |
| `runFile(args)` | Parse and run one `.vn` source with the full stdlib loaded. Returns `{ problems, result }`. |
| `RunFileOutcome` | The result type: `Problem[]` plus the runtime's `RunResult`. |
| `runCommand(options)` | What `venn test` does for one file: collect, run, report, return an exit code. |
| `verifyPluginCommand({ path })` | What `venn verify-plugin` does. |
| `createStdoutSink()` | An NDJSON `EventSink` that writes each envelope to stdout. |
| `reportProblems(problems)` | Print `VNxxxx` problems to stderr with their source location. |

`runFile` takes the ports it should use, so a test can drive it entirely offline:

```ts
import { createTestHost } from "@venn-lang/contracts";
import { createFakeClient, okResponse } from "@venn-lang/http";
import { createMemorySink } from "@venn-lang/runtime";
import { runFile } from "@venn-lang/cli";

const source = `module demo.hello
use "venn/http"
use "venn/assert"

flow "Hello" {
  step "Ping" {
    const res = http.get "https://example.com"
    expect res.status == 200
  }
}`;

const outcome = await runFile({
  source,
  uri: "memory://hello.vn",
  host: createTestHost(),
  sink: createMemorySink(),
  httpClient: createFakeClient({
    responses: { "https://example.com": okResponse({ status: 200 }) },
  }),
});

outcome.problems; // []
outcome.result?.passed; // 1
```

`mode: "script"` runs the file top to bottom instead of running its flows. `filter`, `bail`, `env`,
`io`, `npm` and `cleanup` are the rest of what the commands pass in.

## See also

- [`@venn-lang/runtime`](../runtime) for the scheduler, the plugin registry and the event stream.
- [`@venn-lang/project`](../project) for manifests, workspaces, lockfiles and build profiles.
- [`@venn-lang/contracts`](../contracts) for the ports and the Node implementations bound here.
- [`@venn-lang/lsp`](../lsp) for the same compiler behind an editor.
