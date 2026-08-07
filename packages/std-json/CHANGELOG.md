# @venn-lang/json

## 0.7.5

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.7.5
  - @venn-lang/sdk@0.7.5
  - @venn-lang/types@0.7.5

## 0.7.4

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.7.4
  - @venn-lang/sdk@0.7.4
  - @venn-lang/types@0.7.4

## 0.7.3

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.7.3
  - @venn-lang/sdk@0.7.3
  - @venn-lang/types@0.7.3

## 0.7.2

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.7.2
  - @venn-lang/sdk@0.7.2
  - @venn-lang/types@0.7.2

## 0.7.1

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.7.1
  - @venn-lang/sdk@0.7.1
  - @venn-lang/types@0.7.1

## 0.7.0

### Patch Changes

- [#210](https://github.com/venn-lang/venn/pull/210) [`aca64bc`](https://github.com/venn-lang/venn/commit/aca64bc5338e4a78e0835e44bd894a56519cff0e) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - One rule for when a verb fails, and the verbs that disagreed with it fixed.

  The stdlib answered the same question three ways, and one namespace did two of
  them: `date.in` answered `null` for a timezone that is not one while
  `date.format` refused the same name. Nothing decided this. Each verb was written
  on its own day, so every one had to be looked up, and the one looked up last week
  is the one that ends the run in production.

  The rule is now written where a plugin author reads it, in the SDK's README:

  - **The world failed**, so raise. A refused connection, a driver that is not
    there. Nothing the program wrote is wrong and nothing it can read would help.
  - **The caller made a mistake**, so raise. A timezone that is not one, a range
    whose end is below its start. It is a bug in the program, and the run ending at
    the bug is the shortest way to the fix. That is `VN7005`.
  - **The data was unreadable**, so answer with `null`. Text from a server, a field
    nobody set. Being unreadable is an ordinary thing for data to be.

  A `tryX` twin belongs only where both readings are common enough to want a name
  each, as with `json.parse` and `json.tryParse`, and never as the only spelling.

  ### What changed

  | Verb                    | Was                               | Is                                             |
  | ----------------------- | --------------------------------- | ---------------------------------------------- |
  | `date.in`               | `null` for a zone that is not one | refuses it, as `date.format` already did       |
  | `date.format`           | refused, with no code             | refuses with `VN7005`, and the same words      |
  | `data.range(10, 1)`     | a number outside both ends        | refuses with `VN7005`                          |
  | `data.oneOf()`          | nothing                           | refuses with `VN7005`                          |
  | `math.randomInt(10, 1)` | a number outside both ends        | refuses with `VN7005`                          |
  | `data.json`             | whatever the runtime threw        | refuses with `VN7003`, in the language's words |
  | `json.parse`            | refused, with no code             | refuses with `VN7003`                          |
  | `http.on`               | refused, with no code             | refuses with `VN7005`                          |

  `date.in` no longer answers `null`, so its type is the parts rather than the
  parts or nothing.

- Updated dependencies [[`d272818`](https://github.com/venn-lang/venn/commit/d272818687f122e5f6a40a3be565f0cb0e4a1910), [`18e17f9`](https://github.com/venn-lang/venn/commit/18e17f939db96ff45a8a2336069ffeeab75c055e), [`6cf0a30`](https://github.com/venn-lang/venn/commit/6cf0a303448261a11c87e57df191229e951b3098), [`4c1eac1`](https://github.com/venn-lang/venn/commit/4c1eac1e18717cf39b5f7d75aa596c52f31a7457), [`902dd90`](https://github.com/venn-lang/venn/commit/902dd906f630e28a46e2ef530766d53fcf5cbe6e), [`d39bace`](https://github.com/venn-lang/venn/commit/d39bace59fb888f519f553a29e4c342db6ab0afa), [`aca64bc`](https://github.com/venn-lang/venn/commit/aca64bc5338e4a78e0835e44bd894a56519cff0e), [`a0fbdcc`](https://github.com/venn-lang/venn/commit/a0fbdccd7c39d81a8176218e6a0bc3c1d0885068), [`8d448a9`](https://github.com/venn-lang/venn/commit/8d448a992d10cacfffb09a08f44fa04e540d46b4), [`d0915ca`](https://github.com/venn-lang/venn/commit/d0915ca3b941233265e804268ff31cfffb468644), [`eba6e01`](https://github.com/venn-lang/venn/commit/eba6e011d3f311e23e5958fc264b99c6b4acf28e)]:
  - @venn-lang/contracts@0.7.0
  - @venn-lang/sdk@0.7.0
  - @venn-lang/types@0.7.0

## 0.6.0

### Minor Changes

- [#149](https://github.com/venn-lang/venn/pull/149) [`2f6fc07`](https://github.com/venn-lang/venn/commit/2f6fc07efdb01a3407a926a0e8222f81a13b5e58) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Read text into a value.

### Patch Changes

- Updated dependencies [[`5fe5dcd`](https://github.com/venn-lang/venn/commit/5fe5dcd265374e8bf5ff7fbfebfd26b4c2930ffe)]:
  - @venn-lang/sdk@0.6.0
  - @venn-lang/types@0.6.0
