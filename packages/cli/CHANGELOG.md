# @venn-lang/cli

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
