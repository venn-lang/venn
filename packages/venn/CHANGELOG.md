# @venn-lang/venn

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
