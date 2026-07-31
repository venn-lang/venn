# @venn-lang/prelude

What Venn brings with it: the names in scope before anything is imported.

Everything else in the language is imported by name, so this package is the whole
answer to "where did this come from" when the answer is "nowhere, it was always
there". One list, described in the same wire format a plugin publishes, read by
the checker, the editor and the runtime rather than each keeping its own copy.

```ts
import { PRELUDE, isPrelude, preludeVerbs } from "@venn-lang/prelude";

isPrelude("print");     // true
preludeVerbs();         // ["print", "log", "wait", "skip", "fail", "exit"]
PRELUDE.range.doc;      // "A list of numbers, counting up or down. …"
```

## What is in it

| | |
| --- | --- |
| values | `regex` `spawn` `range` `str` `typeOf` `pretty` |
| verbs | `print` `log` `wait` `skip` `fail` `exit` |
| types | `regex` |

A **value** may be written anywhere a value goes, including inside an
expression: `xs.take(range(3).len)`. A **verb** is a statement the runtime
carries out, so it has somewhere to write to and something to record, and there
is nothing to read back from it.

## What it exports

- **`PRELUDE`**: every name, with its signature as a `TypeSpec`, its
  documentation and its arguments one by one.
- **`PRELUDE_TYPES`**: the named types the language brings, which is `regex`.
- **`isPrelude(name)`**, **`preludeValues()`**, **`preludeVerbs()`**: the
  questions the compiler and the runtime actually ask.

## Why it is a package

Because the answer to "what comes native" should be readable without reading the
compiler, and because nothing should be able to add to it quietly. The kernel
implements the values and the runtime carries out the verbs, and both are checked
against this list by tests that fail if any of the three drift apart.
