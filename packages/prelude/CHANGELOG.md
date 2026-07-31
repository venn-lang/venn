# @venn-lang/prelude

## 0.6.0

### Minor Changes

- [#141](https://github.com/venn-lang/venn/pull/141) [`3534c4c`](https://github.com/venn-lang/venn/commit/3534c4c3fbc4c9cafe69798290add826098e0ba6) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - **This breaks every file that says `use`.** Before 1.0 a break rides a minor
  bump, which is the 0.x convention; the version to read it by is the changelog,
  not the number.

  Remove `use`, and bring everything in by name.

  ```venn
  import { http } from "venn/http"
  import { expect } from "venn/assert"
  ```

  One keyword brings a namespace, a verb, a matcher, a type or a value into a
  file, and nothing arrives unasked except the prelude. `use` parsed a whole
  package in and left the file quiet about what it actually took, which is the
  difference between reading an import and guessing one.

### Patch Changes

- Updated dependencies []:
  - @venn-lang/types@0.6.0
