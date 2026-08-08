# @venn-lang/venn

## 0.9.0

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.9.0
  - @venn-lang/toolchain@0.9.0

## 0.8.1

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.8.1
  - @venn-lang/toolchain@0.8.1

## 0.8.0

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.8.0
  - @venn-lang/toolchain@0.8.0

## 0.7.5

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.7.5
  - @venn-lang/toolchain@0.7.5

## 0.7.4

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.7.4
  - @venn-lang/toolchain@0.7.4

## 0.7.3

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.7.3
  - @venn-lang/toolchain@0.7.3

## 0.7.2

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.7.2
  - @venn-lang/toolchain@0.7.2

## 0.7.1

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.7.1
  - @venn-lang/toolchain@0.7.1

## 0.7.0

### Patch Changes

- Updated dependencies [[`d272818`](https://github.com/venn-lang/venn/commit/d272818687f122e5f6a40a3be565f0cb0e4a1910), [`18e17f9`](https://github.com/venn-lang/venn/commit/18e17f939db96ff45a8a2336069ffeeab75c055e), [`6cf0a30`](https://github.com/venn-lang/venn/commit/6cf0a303448261a11c87e57df191229e951b3098), [`4c1eac1`](https://github.com/venn-lang/venn/commit/4c1eac1e18717cf39b5f7d75aa596c52f31a7457), [`a0fbdcc`](https://github.com/venn-lang/venn/commit/a0fbdccd7c39d81a8176218e6a0bc3c1d0885068), [`eba6e01`](https://github.com/venn-lang/venn/commit/eba6e011d3f311e23e5958fc264b99c6b4acf28e)]:
  - @venn-lang/contracts@0.7.0
  - @venn-lang/toolchain@0.7.0

## 0.6.0

### Patch Changes

- Updated dependencies [[`9193aeb`](https://github.com/venn-lang/venn/commit/9193aebcb85e1cac72fef13fa005fdb5d82c47a3), [`70ae154`](https://github.com/venn-lang/venn/commit/70ae1549871c8a007eab67d8173d66906eb51688)]:
  - @venn-lang/contracts@0.6.0
  - @venn-lang/toolchain@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.5.0
  - @venn-lang/toolchain@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.4.0
  - @venn-lang/toolchain@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.3.0
  - @venn-lang/toolchain@0.3.0

## 0.2.0

### Minor Changes

- [#108](https://github.com/venn-lang/venn/pull/108) [`f99e1b3`](https://github.com/venn-lang/venn/commit/f99e1b31b2d8f0242d0329e1693dbe187f37a5b9) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - The `venn` command moved to its own package. If you installed `@venn-lang/cli` from 0.1.x, move across in this order:

  ```bash
  npm rm -g @venn-lang/cli
  npm i -g @venn-lang/venn
  ```

  Both packages want the name `venn`, and npm refuses to take a name another package holds, so installing before removing fails with `EEXIST`. Running the old `venn` after upgrading `@venn-lang/cli` prints these two lines rather than leaving you with a command that is gone.

  Nothing you have written changes. `venn test`, `venn run` and the rest work as they did, on the version each project asks for.

- [#102](https://github.com/venn-lang/venn/pull/102) [`025b5a0`](https://github.com/venn-lang/venn/commit/025b5a00582bdd6a9ff2ace91b23b7e7d7d337c5) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - The `venn` command is an orchestrator that carries no language of its own. It hands the command to the version the directory asked for, forwarding signals and the exit code.

- [#102](https://github.com/venn-lang/venn/pull/102) [`025b5a0`](https://github.com/venn-lang/venn/commit/025b5a00582bdd6a9ff2ace91b23b7e7d7d337c5) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Installing `venn` fetches the newest language in the background, so the first command does not wait for it. A registry that cannot be reached is not an install failure: the language arrives on first use instead.

- [#102](https://github.com/venn-lang/venn/pull/102) [`025b5a0`](https://github.com/venn-lang/venn/commit/025b5a00582bdd6a9ff2ace91b23b7e7d7d337c5) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - `venn version install`, `list`, `use` and `remove`, so a machine can hold several versions of the language and each project pick one.

### Patch Changes

- [#107](https://github.com/venn-lang/venn/pull/107) [`3053fe7`](https://github.com/venn-lang/venn/commit/3053fe7c091c0dba3b162cd4f55c34454461f148) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Upgrade the language, not the package it came in.

- Updated dependencies [[`faf28f8`](https://github.com/venn-lang/venn/commit/faf28f8ea225c96d196af52dfcfa11ef42eda6d4), [`025b5a0`](https://github.com/venn-lang/venn/commit/025b5a00582bdd6a9ff2ace91b23b7e7d7d337c5), [`025b5a0`](https://github.com/venn-lang/venn/commit/025b5a00582bdd6a9ff2ace91b23b7e7d7d337c5), [`025b5a0`](https://github.com/venn-lang/venn/commit/025b5a00582bdd6a9ff2ace91b23b7e7d7d337c5)]:
  - @venn-lang/toolchain@0.2.0
  - @venn-lang/contracts@0.2.0
