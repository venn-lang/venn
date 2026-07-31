# @venn-lang/core

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

- [#151](https://github.com/venn-lang/venn/pull/151) [`b126f71`](https://github.com/venn-lang/venn/commit/b126f712fcf7fb2229bd1af2888d440a7793c189) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Let a moment answer about itself.

- [#150](https://github.com/venn-lang/venn/pull/150) [`5fe5dcd`](https://github.com/venn-lang/venn/commit/5fe5dcd265374e8bf5ff7fbfebfd26b4c2930ffe) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - The constants and functions a number has no member for.

### Patch Changes

- Updated dependencies [[`3534c4c`](https://github.com/venn-lang/venn/commit/3534c4c3fbc4c9cafe69798290add826098e0ba6), [`9193aeb`](https://github.com/venn-lang/venn/commit/9193aebcb85e1cac72fef13fa005fdb5d82c47a3), [`70ae154`](https://github.com/venn-lang/venn/commit/70ae1549871c8a007eab67d8173d66906eb51688)]:
  - @venn-lang/prelude@0.6.0
  - @venn-lang/contracts@0.6.0
  - @venn-lang/types@0.6.0

## 0.5.0

### Minor Changes

- [#131](https://github.com/venn-lang/venn/pull/131) [`4d59574`](https://github.com/venn-lang/venn/commit/4d59574ab379a127b81119a8d2b0b032605ab249) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Take a value apart where it is bound.

- [#136](https://github.com/venn-lang/venn/pull/136) [`6ad7352`](https://github.com/venn-lang/venn/commit/6ad7352424bb745e0bde9a2ec8e7af2e34320c63) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Let a match arm ask for more than the shape.

- [#129](https://github.com/venn-lang/venn/pull/129) [`da8f14f`](https://github.com/venn-lang/venn/commit/da8f14f3c98cdb4560dbf34522108f5eb7bef1ba) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Let an argument be negative.

- [#137](https://github.com/venn-lang/venn/pull/137) [`80fe6bd`](https://github.com/venn-lang/venn/commit/80fe6bd5099d04a2a57779583ec6c7070b2fec46) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Let a match arm be reached more than one way.

- [#132](https://github.com/venn-lang/venn/pull/132) [`9e97e7c`](https://github.com/venn-lang/venn/commit/9e97e7c4f68f53e9dfcd32aa2175e9f89942b952) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Decide between shapes with every case accounted for.

- [#138](https://github.com/venn-lang/venn/pull/138) [`2246faa`](https://github.com/venn-lang/venn/commit/2246faa06276fafbcb4e67b2a7acefe2cbe39eb5) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Let a pattern take what is left.

- [#140](https://github.com/venn-lang/venn/pull/140) [`fee4e1a`](https://github.com/venn-lang/venn/commit/fee4e1a0a0a2f6b74205b9e617db472fd1e23a28) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Pour a list into a list and a map into a map.

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.5.0
  - @venn-lang/types@0.5.0

## 0.4.0

### Minor Changes

- [#127](https://github.com/venn-lang/venn/pull/127) [`5fc1774`](https://github.com/venn-lang/venn/commit/5fc17743005962cbc420580fd292a0ee31e5b291) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Tell a union's branches apart.

- [#126](https://github.com/venn-lang/venn/pull/126) [`e12a24d`](https://github.com/venn-lang/venn/commit/e12a24d8f81d38568f4d66a7a2b16d4aa9b5ca10) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Let a signature be polymorphic.

- [#122](https://github.com/venn-lang/venn/pull/122) [`17b6fdb`](https://github.com/venn-lang/venn/commit/17b6fdbecbe4f567b750f58eb3f3ffef5448f1df) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Let a type hold a shape written where it is used.

- [#124](https://github.com/venn-lang/venn/pull/124) [`7a21703`](https://github.com/venn-lang/venn/commit/7a21703916428e1d32a1ad2757820d493fbc03c4) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Make regex a type rather than a label.

### Patch Changes

- [#128](https://github.com/venn-lang/venn/pull/128) [`d05eb04`](https://github.com/venn-lang/venn/commit/d05eb04c415f3dd090e883a1909618ea00e782a6) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Let null stand in a union.

- Updated dependencies [[`e12a24d`](https://github.com/venn-lang/venn/commit/e12a24d8f81d38568f4d66a7a2b16d4aa9b5ca10)]:
  - @venn-lang/types@0.4.0
  - @venn-lang/contracts@0.4.0

## 0.3.0

### Minor Changes

- [#121](https://github.com/venn-lang/venn/pull/121) [`a8ad8b2`](https://github.com/venn-lang/venn/commit/a8ad8b205b257e9c57022b52ae3d20780b5a452a) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - One loop for every end that is not known in advance.

- [#120](https://github.com/venn-lang/venn/pull/120) [`03f7331`](https://github.com/venn-lang/venn/commit/03f73316ef5e2517dc0ca0085340bf684c4f0aa0) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Let a file publish a type and a constant.

- [#119](https://github.com/venn-lang/venn/pull/119) [`5fd9dc5`](https://github.com/venn-lang/venn/commit/5fd9dc5712065d8046de2c5621f4a7aa263536ac) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Raw strings and blocks, as the specification says.

### Patch Changes

- [#117](https://github.com/venn-lang/venn/pull/117) [`badce1b`](https://github.com/venn-lang/venn/commit/badce1b8073274554ecc6d7b3033eb6daad2665b) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Read a bracketed argument the way the rule says.

- [#115](https://github.com/venn-lang/venn/pull/115) [`f6016f3`](https://github.com/venn-lang/venn/commit/f6016f39dea8fb4d1b64bbb5163e6aedd7bac1ab) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Say what to write when an argument holds an operator.

- [#112](https://github.com/venn-lang/venn/pull/112) [`873c398`](https://github.com/venn-lang/venn/commit/873c39842b9d3b6095286d8dc08cb7862d19f2d5) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Let ?. ask about a field the shape does not carry.

- [#110](https://github.com/venn-lang/venn/pull/110) [`adb36ab`](https://github.com/venn-lang/venn/commit/adb36abf8cc2026eac6fd4cf56b079c660a2a6ec) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Fill the placeholders in a step title.

- [#114](https://github.com/venn-lang/venn/pull/114) [`0735ab6`](https://github.com/venn-lang/venn/commit/0735ab6d7856672c3b300ec825de404ec20c4945) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Check the shape a decorator leaves, not the one written.

- Updated dependencies []:
  - @venn-lang/contracts@0.3.0
  - @venn-lang/types@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.2.0
  - @venn-lang/types@0.2.0

## 0.1.3

### Patch Changes

- Updated dependencies [[`cd42016`](https://github.com/venn-lang/venn/commit/cd420167006ad0ac34dc57dd7a6676516e1ca97d)]:
  - @venn-lang/contracts@0.1.3
  - @venn-lang/types@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [[`906eb82`](https://github.com/venn-lang/venn/commit/906eb826eb0130f198d52ffa03903be54eacfd89)]:
  - @venn-lang/contracts@0.1.2
  - @venn-lang/types@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.1.1
  - @venn-lang/types@0.1.1

## 0.1.0

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.1.0
  - @venn-lang/types@0.1.0
