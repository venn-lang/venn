# @venn/project

> What a Venn project *is*: its manifest, its workspace members, what it builds, and where the build goes.

Every command needs the same three answers before it can do anything: which project this path
belongs to, what that project builds, and where derived files live. This package answers them once.
It touches the disk only through the `FileSystem` port from [`@venn/contracts`](../contracts), and
imports no `node:*`, so the language server reads a workspace exactly the way the CLI does.

## Usage

```ts
import { createNodeFs } from "@venn/contracts/node";
import { findProject } from "@venn/project";

const { project, problems } = await findProject({ fs: createNodeFs(), from: process.cwd() });
if (!project) throw new Error(problems[0]?.title);

for (const pkg of project.packages) {
  for (const target of pkg.targets) {
    console.log(`${pkg.manifest.name}: ${target.kind} ${target.name} → ${target.path}`);
  }
}
```

`findProject` walks up from `from` looking for a `venn.toml`, the way `cargo` and `git` do, so a
command run three directories deep means what it means at the top. A package is claimed by an
ancestor workspace only when that workspace's `members` actually name it: sitting inside someone's
folder is not membership. When nothing is found, `project` is absent and `problems` holds one
`ProjectProblem` with code `VN2101`.

## API

### Discovery

| Export | What it does |
| --- | --- |
| `findProject({ fs, from })` | The project a path belongs to, members loaded and inheritance applied. Returns `FoundProject`. |
| `loadPackage({ fs, dir, workspace?, workspaceDir? })` | One package: its manifest with workspace inheritance merged, aliases reanchored, targets resolved. |
| `readManifest({ fs, dir })` | Parses the `venn.toml` in this directory, or `undefined` when there is none. |
| `conventionalTargets({ fs, dir, declared, packageName })` | The declared targets plus the conventional ones that exist on disk. |
| `MANIFEST_FILE` | `"venn.toml"`. |

### Model

| Type | Shape |
| --- | --- |
| `Project` | `root`, `isWorkspace`, `rootManifest`, `packages`, `defaultPackages`. A lone package is a workspace of one, so nothing downstream has to ask which it is. |
| `Package` | `dir`, `manifest`, `targets`. |
| `FoundProject` | `{ project?, problems }`. |
| `ProjectProblem` | `{ code, title, path? }`. Never a raw error from the disk. |

`Manifest`, `PackageInfo`, `BuildTarget`, `Dependency` and `Profile` are re-exported from
[`@venn/contracts`](../contracts), which owns the TOML reader.

### Workspaces

| Export | What it does |
| --- | --- |
| `memberDirs({ fs, root, workspace })` | The directories the members occupy, exclusions applied, anything without a `venn.toml` dropped. |
| `inherit({ manifest, from })` | A member manifest with what the root supplies filled in. |
| `expandMembers({ fs, root, patterns })` | Expands `packages/*` against the disk. `*` is one segment; `**` is deliberately not read. |
| `matchesMember({ path, patterns })` | Whether a path *would* be caught by the globs, without looking at the disk. Needed before the directory exists. |

### Paths

Path arithmetic on manifest paths as text with forward slashes, so it works in a Web Worker:
`normalise`, `join`, `parentOf`, `baseName`, `ancestors`, `isInside`, `relativeTo`, `reanchor`.

`reanchor({ path, declaredIn, usedIn })` is the one that is not obvious. A root writes
`"#shared" = "./shared"` once; read from `packages/api` that means somewhere else entirely, so an
inherited alias is rewritten to `"../../shared"` on the way down. An alias the member wrote itself
is left exactly as written.

### Target directory

| Export | What it does |
| --- | --- |
| `TARGET_DIR`, `TARGET_LAYOUT` | `"target"`, and the names inside it. |
| `targetDir(root)` | `<root>/target`. |
| `modulesDir(root)` | `<root>/target/node_modules`. |
| `nativeModulesDir(root)` | `<root>/target/native_modules`. |
| `outputDir({ root, profile })` | `<root>/target/debug` or `<root>/target/release`. `ProfileName` is `"debug" \| "release"`. |
| `writeBuildRecord({ fs, root, record })` | Writes `build.json` into the profile's output directory and returns its path. |
| `RECORD_FILE`, `BuildRecord`, `BuiltTarget` | `"build.json"`, and what it holds. |

### Dependencies and the lock

| Export | What it does |
| --- | --- |
| `packageJsonFor({ manifest, members? })` | The `package.json` the package manager is shown, generated into `target/`. Path dependencies are left out; `[patch]` becomes `overrides`. |
| `managerCommand({ manager, verb, packages?, dev?, platform })` | The command a verb becomes in pnpm, npm, bun or yarn, and whether it needs a shell. |
| `isSafeSpec(spec)` | Whether a string is a package specifier and nothing else. |
| `readInstalled({ fs, root })` | Every package under `target/node_modules`, scoped ones included, in name order. |
| `hashPackage({ fs, dir })` | `sha256-…` over the files a package installed, as a hash of hashes. |
| `writeLockfile({ fs, root, manager })` / `readLockfile({ fs, root })` | `venn.lock` at the project root. |
| `verifyLock({ fs, root, lock })` | What is installed against what the lock records, as a list of `Drift`. |
| `describeDrift(drift)` | One line per package that differs. |
| `LOCK_FILE`, `LOCK_VERSION`, `Lockfile`, `LockedPackage` | `"venn.lock"`, version `1`, and its shape. |

### Scaffolding

`scaffold(request)` returns the files a new project starts as, as `ScaffoldFile[]`. It is pure: it
says what should exist and the caller writes it, which is what lets `--dry-run` and the tests see
the same answer as the disk. `ScaffoldKind` is `"lib" | "bin" | "workspace"`, and
`insideWorkspace` changes *what* is written, not only where: a member leaves out the version it
would inherit and carries no `.gitignore`, because the root already owns the one `target/` there is.

## What a package builds when it does not say

| On disk | Target |
| --- | --- |
| `src/lib.vn` | a `lib` named after the package |
| `src/main.vn` | a `bin` named after the package |
| `src/bin/<name>.vn` | a `bin` named after the file |

A declared target wins, matched by kind and name, so writing `[lib]` with another `path` moves the
library rather than adding a second one.

## What a member takes from its root

Two things are inherited and they work differently. `[workspace.package]` is a default: the
member's own value wins wherever it wrote one. A dependency marked `{ workspace = true }` is a
request, so the root's answer replaces whatever was there. `[env.*]` tables and `[paths]` merge per
key, with the member winning.

```toml
[workspace]
members = ["packages/*"]
exclude = ["packages/legacy"]
default-members = ["packages/api"]

[workspace.package]
version = "2.0.0"
license = "MIT"

[workspace.dependencies]
zod = "^4.2.0"

[paths]
"#shared" = "./shared"

[env.staging]
BASE_URL = "https://staging.acme.dev"
```

```toml
# packages/api/venn.toml
[package]
name = "api"          # version and licence come from the root

[dependencies]
zod = { workspace = true }
shared = { path = "../shared" }
```

## Why `node_modules` lives in `target/`

One directory holds every derived thing, the way Cargo's does, so deleting it costs time and
nothing else. The placement of the modules inside it is load-bearing rather than tidiness: Node
resolves a package by walking up from the importing file, and built output sits in `target/debug`
or `target/release`, one level below `target/node_modules`. The ordinary resolver finds them with
no loader, no symlink and no fight with whichever package manager is underneath. The generated
`package.json` goes into `target/` for the same reason: a manager writes `node_modules` beside the
file it was pointed at.

`venn.lock` is written from what is actually installed, not translated out of whichever manager's
own lock produced it. Each entry pins the exact version and a hash of the files that landed on
disk, which every manager produces the same way, so `verifyLock` catches a registry that answered
differently or a file edited by hand.

## See also

- [`@venn/contracts`](../contracts) - the `FileSystem` port and the TOML manifest reader.
- [`@venn/cli`](../cli) - the commands built on this: `new`, `build`, `add`, `install`.
- [`@venn/lsp`](../lsp) - the other reader of the same project model.
