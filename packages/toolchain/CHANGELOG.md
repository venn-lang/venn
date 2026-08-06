# @venn-lang/toolchain

## 0.7.3

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.7.3

## 0.7.2

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.7.2

## 0.7.1

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.7.1

## 0.7.0

### Minor Changes

- [#295](https://github.com/venn-lang/venn/pull/295) [`eba6e01`](https://github.com/venn-lang/venn/commit/eba6e011d3f311e23e5958fc264b99c6b4acf28e) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - The rest of epic [#289](https://github.com/venn-lang/venn/issues/289): three bugs and two catalogues.

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

### Patch Changes

- Updated dependencies [[`d272818`](https://github.com/venn-lang/venn/commit/d272818687f122e5f6a40a3be565f0cb0e4a1910), [`18e17f9`](https://github.com/venn-lang/venn/commit/18e17f939db96ff45a8a2336069ffeeab75c055e), [`6cf0a30`](https://github.com/venn-lang/venn/commit/6cf0a303448261a11c87e57df191229e951b3098), [`4c1eac1`](https://github.com/venn-lang/venn/commit/4c1eac1e18717cf39b5f7d75aa596c52f31a7457), [`a0fbdcc`](https://github.com/venn-lang/venn/commit/a0fbdccd7c39d81a8176218e6a0bc3c1d0885068), [`eba6e01`](https://github.com/venn-lang/venn/commit/eba6e011d3f311e23e5958fc264b99c6b4acf28e)]:
  - @venn-lang/contracts@0.7.0

## 0.6.0

### Patch Changes

- Updated dependencies [[`9193aeb`](https://github.com/venn-lang/venn/commit/9193aebcb85e1cac72fef13fa005fdb5d82c47a3), [`70ae154`](https://github.com/venn-lang/venn/commit/70ae1549871c8a007eab67d8173d66906eb51688)]:
  - @venn-lang/contracts@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.3.0

## 0.2.0

### Minor Changes

- [#90](https://github.com/venn-lang/venn/pull/90) [`faf28f8`](https://github.com/venn-lang/venn/commit/faf28f8ea225c96d196af52dfcfa11ef42eda6d4) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Work out which version a directory wants.

- [#102](https://github.com/venn-lang/venn/pull/102) [`025b5a0`](https://github.com/venn-lang/venn/commit/025b5a00582bdd6a9ff2ace91b23b7e7d7d337c5) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Ask the registry which versions of the language exist, and which one `latest` points at.

- [#102](https://github.com/venn-lang/venn/pull/102) [`025b5a0`](https://github.com/venn-lang/venn/commit/025b5a00582bdd6a9ff2ace91b23b7e7d7d337c5) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Download a version, check what came back against the hash the registry published, and unpack it.

- [#102](https://github.com/venn-lang/venn/pull/102) [`025b5a0`](https://github.com/venn-lang/venn/commit/025b5a00582bdd6a9ff2ace91b23b7e7d7d337c5) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Decide what a directory needs in one call: which version it asked for, whether it is here, and what to run.

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.2.0
