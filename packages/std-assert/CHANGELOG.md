# @venn-lang/assert

## 0.8.0

### Patch Changes

- Updated dependencies []:
  - @venn-lang/sdk@0.8.0
  - @venn-lang/types@0.8.0

## 0.7.5

### Patch Changes

- Updated dependencies []:
  - @venn-lang/sdk@0.7.5
  - @venn-lang/types@0.7.5

## 0.7.4

### Patch Changes

- Updated dependencies []:
  - @venn-lang/sdk@0.7.4
  - @venn-lang/types@0.7.4

## 0.7.3

### Patch Changes

- Updated dependencies []:
  - @venn-lang/sdk@0.7.3
  - @venn-lang/types@0.7.3

## 0.7.2

### Patch Changes

- Updated dependencies []:
  - @venn-lang/sdk@0.7.2
  - @venn-lang/types@0.7.2

## 0.7.1

### Patch Changes

- Updated dependencies []:
  - @venn-lang/sdk@0.7.1
  - @venn-lang/types@0.7.1

## 0.7.0

### Minor Changes

- [#250](https://github.com/venn-lang/venn/pull/250) [`902dd90`](https://github.com/venn-lang/venn/commit/902dd906f630e28a46e2ef530766d53fcf5cbe6e) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - One renderer behind a failing check.

  `print` and `"${…}"` share a definition, and so does `io.print`. A failure title
  did not: `@venn-lang/assert` carried a renderer of its own, with its own rule
  against `[object Object]`, its own quoting and its own fallback to JSON. So
  `print row` gave `{ status: "pending" }` and the red check on the next line gave
  `{"status":"pending"}`, and a duration read as `{"kind":"duration","ms":300}`
  where the print above said `300ms`. It is the worst place for a second answer,
  because a failure is read by somebody who already does not understand what
  happened.

  The renderer lives in `@venn-lang/core`, which a plugin may not depend on, so
  the runtime hands it over, as it already does for actions. `MatcherContext`
  gains `show(value)`, required for the same reason it is required on
  `ActionContext`: an optional member reads as an invitation to write the fallback
  that becomes the second definition. `message` and `detail` receive the context
  as a second argument. `test` does not: a verdict is reached by comparing values,
  and a matcher holding a renderer while deciding one is a matcher that can
  compare their text instead.

  What `@venn-lang/assert` still decides is width, not shape. A title is one line,
  so a side past that budget is cut where it stands and marked with `…`, rather
  than rewritten into prose about the value's shape. A string on the line is
  quoted, the one place a value reads differently from a value on its own, because
  `expect "200" equals 200` failing with `expected 200 to equal 200` is a line
  nobody can act on.

### Patch Changes

- Updated dependencies [[`d272818`](https://github.com/venn-lang/venn/commit/d272818687f122e5f6a40a3be565f0cb0e4a1910), [`18e17f9`](https://github.com/venn-lang/venn/commit/18e17f939db96ff45a8a2336069ffeeab75c055e), [`4c1eac1`](https://github.com/venn-lang/venn/commit/4c1eac1e18717cf39b5f7d75aa596c52f31a7457), [`902dd90`](https://github.com/venn-lang/venn/commit/902dd906f630e28a46e2ef530766d53fcf5cbe6e), [`d39bace`](https://github.com/venn-lang/venn/commit/d39bace59fb888f519f553a29e4c342db6ab0afa), [`aca64bc`](https://github.com/venn-lang/venn/commit/aca64bc5338e4a78e0835e44bd894a56519cff0e), [`8d448a9`](https://github.com/venn-lang/venn/commit/8d448a992d10cacfffb09a08f44fa04e540d46b4), [`d0915ca`](https://github.com/venn-lang/venn/commit/d0915ca3b941233265e804268ff31cfffb468644), [`eba6e01`](https://github.com/venn-lang/venn/commit/eba6e011d3f311e23e5958fc264b99c6b4acf28e)]:
  - @venn-lang/sdk@0.7.0
  - @venn-lang/types@0.7.0

## 0.6.0

### Patch Changes

- Updated dependencies [[`5fe5dcd`](https://github.com/venn-lang/venn/commit/5fe5dcd265374e8bf5ff7fbfebfd26b4c2930ffe)]:
  - @venn-lang/sdk@0.6.0
  - @venn-lang/types@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies []:
  - @venn-lang/sdk@0.5.0
  - @venn-lang/types@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [[`e12a24d`](https://github.com/venn-lang/venn/commit/e12a24d8f81d38568f4d66a7a2b16d4aa9b5ca10)]:
  - @venn-lang/types@0.4.0
  - @venn-lang/sdk@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies []:
  - @venn-lang/sdk@0.3.0
  - @venn-lang/types@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies []:
  - @venn-lang/sdk@0.2.0
  - @venn-lang/types@0.2.0

## 0.1.3

### Patch Changes

- Updated dependencies []:
  - @venn-lang/sdk@0.1.3
  - @venn-lang/types@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies []:
  - @venn-lang/sdk@0.1.2
  - @venn-lang/types@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies []:
  - @venn-lang/sdk@0.1.1
  - @venn-lang/types@0.1.1

## 0.1.0

### Patch Changes

- Updated dependencies []:
  - @venn-lang/sdk@0.1.0
  - @venn-lang/types@0.1.0
