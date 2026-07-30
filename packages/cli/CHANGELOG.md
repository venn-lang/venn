# @venn-lang/cli

## 0.3.0

### Patch Changes

- Updated dependencies [[`a8ad8b2`](https://github.com/venn-lang/venn/commit/a8ad8b205b257e9c57022b52ae3d20780b5a452a), [`03f7331`](https://github.com/venn-lang/venn/commit/03f73316ef5e2517dc0ca0085340bf684c4f0aa0), [`5fd9dc5`](https://github.com/venn-lang/venn/commit/5fd9dc5712065d8046de2c5621f4a7aa263536ac), [`badce1b`](https://github.com/venn-lang/venn/commit/badce1b8073274554ecc6d7b3033eb6daad2665b), [`f6016f3`](https://github.com/venn-lang/venn/commit/f6016f39dea8fb4d1b64bbb5163e6aedd7bac1ab), [`873c398`](https://github.com/venn-lang/venn/commit/873c39842b9d3b6095286d8dc08cb7862d19f2d5), [`adb36ab`](https://github.com/venn-lang/venn/commit/adb36abf8cc2026eac6fd4cf56b079c660a2a6ec), [`0735ab6`](https://github.com/venn-lang/venn/commit/0735ab6d7856672c3b300ec825de404ec20c4945)]:
  - @venn-lang/core@0.3.0
  - @venn-lang/lsp@0.3.0
  - @venn-lang/runtime@0.3.0
  - @venn-lang/stdlib@0.3.0
  - @venn-lang/contracts@0.3.0
  - @venn-lang/dts@0.3.0
  - @venn-lang/project@0.3.0
  - @venn-lang/sdk@0.3.0
  - @venn-lang/assert@0.3.0
  - @venn-lang/http@0.3.0
  - @venn-lang/io@0.3.0
  - @venn-lang/types@0.3.0

## 0.2.0

### Minor Changes

- [#102](https://github.com/venn-lang/venn/pull/102) [`025b5a0`](https://github.com/venn-lang/venn/commit/025b5a00582bdd6a9ff2ace91b23b7e7d7d337c5) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - This package is now a version of the language rather than the command you install. It provides `venn-run` and `venn-lsp`, which the `venn` orchestrator runs. Install `@venn-lang/venn` to get the `venn` command.

- [#108](https://github.com/venn-lang/venn/pull/108) [`f99e1b3`](https://github.com/venn-lang/venn/commit/f99e1b31b2d8f0242d0329e1693dbe187f37a5b9) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - The `venn` command moved to its own package. If you installed `@venn-lang/cli` from 0.1.x, move across in this order:

  ```bash
  npm rm -g @venn-lang/cli
  npm i -g @venn-lang/venn
  ```

  Both packages want the name `venn`, and npm refuses to take a name another package holds, so installing before removing fails with `EEXIST`. Running the old `venn` after upgrading `@venn-lang/cli` prints these two lines rather than leaving you with a command that is gone.

  Nothing you have written changes. `venn test`, `venn run` and the rest work as they did, on the version each project asks for.

### Patch Changes

- [#107](https://github.com/venn-lang/venn/pull/107) [`3053fe7`](https://github.com/venn-lang/venn/commit/3053fe7c091c0dba3b162cd4f55c34454461f148) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Upgrade the language, not the package it came in.

- Updated dependencies []:
  - @venn-lang/contracts@0.2.0
  - @venn-lang/core@0.2.0
  - @venn-lang/dts@0.2.0
  - @venn-lang/lsp@0.2.0
  - @venn-lang/project@0.2.0
  - @venn-lang/runtime@0.2.0
  - @venn-lang/sdk@0.2.0
  - @venn-lang/assert@0.2.0
  - @venn-lang/http@0.2.0
  - @venn-lang/io@0.2.0
  - @venn-lang/stdlib@0.2.0
  - @venn-lang/types@0.2.0

## 0.1.3

### Patch Changes

- [#76](https://github.com/venn-lang/venn/pull/76) [`3e93ea7`](https://github.com/venn-lang/venn/commit/3e93ea70f219eae1d856ed876cd9d0178636ebc1) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Ask node where it is, instead of naming directories.

- Updated dependencies [[`cd42016`](https://github.com/venn-lang/venn/commit/cd420167006ad0ac34dc57dd7a6676516e1ca97d)]:
  - @venn-lang/contracts@0.1.3
  - @venn-lang/core@0.1.3
  - @venn-lang/project@0.1.3
  - @venn-lang/runtime@0.1.3
  - @venn-lang/sdk@0.1.3
  - @venn-lang/http@0.1.3
  - @venn-lang/io@0.1.3
  - @venn-lang/stdlib@0.1.3
  - @venn-lang/assert@0.1.3
  - @venn-lang/dts@0.1.3
  - @venn-lang/types@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [[`906eb82`](https://github.com/venn-lang/venn/commit/906eb826eb0130f198d52ffa03903be54eacfd89)]:
  - @venn-lang/contracts@0.1.2
  - @venn-lang/core@0.1.2
  - @venn-lang/project@0.1.2
  - @venn-lang/runtime@0.1.2
  - @venn-lang/sdk@0.1.2
  - @venn-lang/http@0.1.2
  - @venn-lang/io@0.1.2
  - @venn-lang/stdlib@0.1.2
  - @venn-lang/assert@0.1.2
  - @venn-lang/dts@0.1.2
  - @venn-lang/types@0.1.2

## 0.1.1

### Patch Changes

- [#59](https://github.com/venn-lang/venn/pull/59) [`acb103f`](https://github.com/venn-lang/venn/commit/acb103f51f5ac3530fb71850374714c97fa90cd7) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Report the version the release actually is.

- Updated dependencies []:
  - @venn-lang/contracts@0.1.1
  - @venn-lang/core@0.1.1
  - @venn-lang/dts@0.1.1
  - @venn-lang/project@0.1.1
  - @venn-lang/runtime@0.1.1
  - @venn-lang/sdk@0.1.1
  - @venn-lang/assert@0.1.1
  - @venn-lang/http@0.1.1
  - @venn-lang/io@0.1.1
  - @venn-lang/stdlib@0.1.1
  - @venn-lang/types@0.1.1

## 0.1.0

### Minor Changes

- [#27](https://github.com/venn-lang/venn/pull/27) [`a81b246`](https://github.com/venn-lang/venn/commit/a81b2460324c7a4179b96ff9167cc30b7f55e780) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Add `venn upgrade`, which moves a global install to the latest published version.

  It finds which of npm, pnpm, yarn or bun installed the running copy by reading the path it lives in,
  then runs that manager's own global install. A copy the project owns is left alone, since its version
  is pinned in the manifest, and a path matching no manager is refused rather than guessed at. Use
  `--dry-run` to see the command without running it, or `--yes` to skip the confirmation in a script.

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.1.0
  - @venn-lang/core@0.1.0
  - @venn-lang/dts@0.1.0
  - @venn-lang/project@0.1.0
  - @venn-lang/runtime@0.1.0
  - @venn-lang/sdk@0.1.0
  - @venn-lang/assert@0.1.0
  - @venn-lang/http@0.1.0
  - @venn-lang/io@0.1.0
  - @venn-lang/stdlib@0.1.0
  - @venn-lang/types@0.1.0
