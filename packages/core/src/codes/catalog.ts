import type { CodeSpec } from "./code.types.js";

/**
 * Every VNxxxx the kernel itself can raise. Codes are stable, googlable, and
 * documented; families follow the leading digit (1 lex/syntax … 8 timeout).
 */
export const CODES = {
  VN1001_LEX: { code: "VN1001", severity: "error" },
  VN1002_PARSE: { code: "VN1002", severity: "error" },
  VN1003_MIXED_OPERATORS: { code: "VN1003", severity: "error" },
  /** A string that ended at a quote written inside its own `${…}`. */
  VN1004_STRING_CUT_SHORT: { code: "VN1004", severity: "error" },
  /**
   * An operator the language never had: `+=`, `-=`, `*=`, `/=`, `%=`, `++`, `--`.
   *
   * Not a removed word but a habit brought from elsewhere, and the parse
   * recovery used to read it as an argument that wanted brackets, so `a += 2`
   * was answered with a bracket to put round a line that has nothing to bracket.
   */
  VN1005_NO_SUCH_OPERATOR: { code: "VN1005", severity: "error" },
  VN2003_UNKNOWN_ACTION: { code: "VN2003", severity: "error" },
  VN2004_UNKNOWN_MATCHER: { code: "VN2004", severity: "error" },
  VN2005_UNKNOWN_FRAGMENT: { code: "VN2005", severity: "error" },
  VN2006_UNKNOWN_ENV: { code: "VN2006", severity: "error" },
  /**
   * A namespace, matcher or `env` used in a file that never imported it.
   *
   * A hint and not an error: every run loads the whole stdlib, so the name
   * resolves either way, and refusing it made the compiler contradict itself.
   * `print io.args` asked for `io.args()` under VN2008 and `io.args()` was then
   * refused under this code, so no spelling satisfied both. What is left is
   * worth saying and not worth stopping for: the top of the file should say
   * where a name came from, and the help line spells the import out.
   */
  VN2007_NAMESPACE_NOT_IMPORTED: { code: "VN2007", severity: "hint" },
  VN2008_UNCALLED_ACTION: { code: "VN2008", severity: "error" },
  VN2009_NOT_EXPORTED: { code: "VN2009", severity: "error" },
  VN2013_UNKNOWN_DECORATOR: { code: "VN2013", severity: "error" },
  VN2014_DECORATOR_TARGET: { code: "VN2014", severity: "error" },
  VN2015_DECO_SIGNATURE: { code: "VN2015", severity: "error" },
  VN2016_DECO_IMPURE: { code: "VN2016", severity: "error" },
  VN2017_DECO_VERB: { code: "VN2017", severity: "error" },
  VN2018_UNBOUND_NAME: { code: "VN2018", severity: "error" },
  VN2019_UNREADABLE_IMPORT: { code: "VN2019", severity: "error" },
  VN2020_NAME_TAKEN: { code: "VN2020", severity: "error" },
  VN2021_IMPORT_CYCLE: { code: "VN2021", severity: "error" },
  VN2022_CONST_ASSIGNED: { code: "VN2022", severity: "error" },
  /** A name inside a `deco` body that expansion time cannot reach yet. */
  VN2023_OUT_OF_REACH: { code: "VN2023", severity: "error" },
  /** A declaration inside a `namespace` that grouping names is no place for. */
  VN2025_NOT_A_NAMESPACE_MEMBER: { code: "VN2025", severity: "error" },
  /** A closure reading a name the `let` below it binds, which nothing holds yet. */
  VN2026_READ_BEFORE_BOUND: { code: "VN2026", severity: "error" },
  /**
   * A bare name standing for an action or a namespace where a value is read,
   * which is how `print 1 print 2` merges into one statement instead of failing.
   */
  VN2027_NOT_A_VALUE: { code: "VN2027", severity: "error" },
  /**
   * An import whose path names no package the run loaded, which used to be
   * accepted in silence and surface later as a call on an empty object.
   */
  VN2028_NO_SUCH_PACKAGE: { code: "VN2028", severity: "error" },
  VN3001_UNKNOWN_OPTION: { code: "VN3001", severity: "error" },
  /** A verb or matcher handed more positional arguments than it takes, or fewer. */
  VN3002_ARGUMENT_COUNT: { code: "VN3002", severity: "error" },
  VN3010_TYPE_MISMATCH: { code: "VN3010", severity: "error" },
  VN3012_UNIT_MISMATCH: { code: "VN3012", severity: "error" },
  VN3013_NOT_CALLABLE: { code: "VN3013", severity: "error" },
  /**
   * Retired: nothing raises it. It named a value read as if it had settled
   * while it was still on its way, and `expr/pending.ts` made that unreachable
   * by chaining onto whatever is waiting instead of reading it, which is why
   * `await` is never written in this language. Kept
   * declared so the number is never reused for something else, since a code is
   * meant to stay googlable after it stops being raised.
   */
  VN3014_STILL_WAITING: { code: "VN3014", severity: "error" },
  VN3015_NOT_A_LIST: { code: "VN3015", severity: "error" },
  VN3016_NOT_A_NUMBER: { code: "VN3016", severity: "error" },
  VN3017_DECO_ARGUMENTS: { code: "VN3017", severity: "error" },
  VN3018_BAD_PATTERN: { code: "VN3018", severity: "error" },
  VN3019_MISSING_CASE: { code: "VN3019", severity: "error" },
  VN3020_UNREACHABLE_CASE: { code: "VN3020", severity: "error" },
  VN3021_NOT_A_PLACE: { code: "VN3021", severity: "error" },
  VN3022_RESERVED_CODE: { code: "VN3022", severity: "error" },
  /**
   * A write whose key is `__proto__`, `constructor` or `prototype`, which
   * reaches what made the value rather than the value itself.
   */
  VN3023_RESERVED_KEY: { code: "VN3023", severity: "error" },
  /**
   * `+` written between strings, which adds numbers and joins nothing.
   *
   * Its own code rather than VN3010 because the two types are not the mistake:
   * naming them printed `expected number, found string` twice and, where the
   * result was bound to a string, `expected string, found number` after it,
   * three lines at one column contradicting each other and none of them saying
   * the word interpolation.
   */
  VN3024_JOINED_WITH_PLUS: { code: "VN3024", severity: "error" },
  /**
   * A member read through a value that may be nothing: `xs[5].len`, where the
   * read is out of range and the run answers `null`.
   *
   * Its own code rather than VN3010 because nothing here is a clash of two
   * types. What was written could be right, and the reader has to be told which
   * of the two ordinary answers to give it, not which two types met.
   */
  VN3025_MAY_BE_NOTHING: { code: "VN3025", severity: "error" },
  /**
   * A list pattern handed a list of another length, where the pattern had to
   * match: a `let`, a `const`, a `forEach`, or a `fn` parameter.
   *
   * Its own code rather than VN3010 because no two types meet here. There is no
   * tuple type, so `[[1, 2]]` is a `list<list<number>>` and how many items one
   * holds is knowable exactly once, when the value arrives. A `match` arm asks
   * the same question and simply moves to the next arm; the positions that
   * cannot move on are the ones that report.
   */
  VN3026_PATTERN_ITEM_COUNT: { code: "VN3026", severity: "error" },
  /**
   * A `continue` whose value does not become the loop's state: it drops a field
   * the state carries, or the loop it belongs to carries nothing at all.
   *
   * Its own code rather than VN3010 for the reason VN3025 gives. A dropped
   * field printed as two shapes makes the reader diff `{ a: number, b: string }`
   * against `{ a: number }` by eye to learn one word, `b`. A plain clash of two
   * types stays on VN3010, where naming them is the whole explanation.
   */
  VN3027_STATE_NOT_CARRIED: { code: "VN3027", severity: "error" },
  /**
   * Arithmetic with no number to answer with: `1 / 0`, `0 / 0`, `x % 0`, or the
   * square root of a negative.
   *
   * The alternative is what each of these used to do, which is hand back
   * `Infinity` or `NaN`. Both are values, both flow on through every sum after
   * them, and neither was ever the answer to the question asked. A reader who
   * divided by zero has a bug in the program and wants it here, not six lines
   * later where the number stops making sense.
   */
  VN3030_NO_NUMERIC_ANSWER: { code: "VN3030", severity: "error" },
  /**
   * A builtin handed a number that names nothing it can do: a count below zero,
   * a chunk size of zero, a fraction where only whole items exist, a position
   * before the start of a list.
   *
   * Its own code rather than VN3010 because the type is right and the value is
   * not: `take` really does want a number, and `-1` really is one. What has to
   * be said is the range, and no pair of type names carries a range.
   */
  VN3031_ARGUMENT_OUT_OF_RANGE: { code: "VN3031", severity: "error" },
  /** A `race` or a `parallel` with no branches in it, which can decide nothing. */
  VN4001_NOTHING_TO_RUN: { code: "VN4001", severity: "error" },
  VN5001_REMOVED_KEYWORD: { code: "VN5001", severity: "error" },
  /**
   * Retired: folded into VN5007, which says the same sentence about any verb
   * rather than about three. Kept declared so the number is never reused for
   * something else, since a code is meant to stay googlable after it stops
   * being raised.
   */
  VN5002_SWALLOWED_ARGUMENT: { code: "VN5002", severity: "error" },
  VN5003_DUPLICATE_KEY: { code: "VN5003", severity: "error" },
  VN5004_UNKNOWN_EVENT: { code: "VN5004", severity: "error" },
  VN5005_UNUSED_IMPORT: { code: "VN5005", severity: "hint" },
  /** `==` or `!=` between two lists or two maps: reference equality, always false. */
  VN5006_IDENTITY_COMPARISON: { code: "VN5006", severity: "error" },
  /** A trailing map literal read as a verb's options block when it was meant as a value. */
  VN5007_OPTIONS_NOT_A_VALUE: { code: "VN5007", severity: "error" },
  /** `{ concurrency: n }` on a `forEach` inside a `fn`, where a pure body runs one pass at a time. */
  VN5008_CONCURRENCY_IN_A_PURE_BODY: { code: "VN5008", severity: "error" },
  /**
   * A pure call standing alone as a statement, whose result nothing keeps.
   *
   * `rows.push(x)` is the expensive one: it reads as a completed statement and
   * is a copy whose copy is thrown away, so a program printed `months: 0` and
   * no diagnostic. A warning rather than an error, because the statement is
   * legal and the run is well defined; what is wrong is that it does nothing.
   */
  VN5009_DISCARDED_RESULT: { code: "VN5009", severity: "warning" },
  /** A verb handed to a lambda, where the grammar wants one value: `xs.forEach(r => print r)`. */
  VN5010_VERB_IN_A_LAMBDA: { code: "VN5010", severity: "error" },
  VN6001_ASSERTION_FAILED: { code: "VN6001", severity: "error" },
  /**
   * `fail "…"` with no code of its own, which is a program refusing itself.
   *
   * In the kernel's catalogue rather than the runtime's because a `fn` body is
   * compiled: the compiler raises this where a `fail` is written in one, and the
   * scheduler raises it everywhere else, and the two must agree.
   */
  VN6002_FAILED: { code: "VN6002", severity: "error" },
  VN7001_ACTION_FAILED: { code: "VN7001", severity: "error" },
  VN7004_HOOK_FAILED: { code: "VN7004", severity: "error" },
} as const satisfies Record<string, CodeSpec>;
