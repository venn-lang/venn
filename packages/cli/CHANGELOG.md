# @venn-lang/cli

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
