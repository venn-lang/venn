import type { CodeSpec } from "./code.types.js";

/**
 * Every VNxxxx the kernel itself can raise. Codes are stable, googlable, and
 * documented; families follow the leading digit (1 lex/syntax … 8 timeout).
 */
export const CODES = {
  VN1001_LEX: { code: "VN1001", severity: "error" },
  VN1002_PARSE: { code: "VN1002", severity: "error" },
  VN1003_MIXED_OPERATORS: { code: "VN1003", severity: "error" },
  VN2003_UNKNOWN_ACTION: { code: "VN2003", severity: "error" },
  VN2004_UNKNOWN_MATCHER: { code: "VN2004", severity: "error" },
  VN2005_UNKNOWN_FRAGMENT: { code: "VN2005", severity: "error" },
  VN2006_UNKNOWN_ENV: { code: "VN2006", severity: "error" },
  VN2007_NAMESPACE_NOT_IMPORTED: { code: "VN2007", severity: "error" },
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
  VN3001_UNKNOWN_OPTION: { code: "VN3001", severity: "error" },
  VN3010_TYPE_MISMATCH: { code: "VN3010", severity: "error" },
  VN3012_UNIT_MISMATCH: { code: "VN3012", severity: "error" },
  VN3013_NOT_CALLABLE: { code: "VN3013", severity: "error" },
  VN3014_STILL_WAITING: { code: "VN3014", severity: "error" },
  VN3015_NOT_A_LIST: { code: "VN3015", severity: "error" },
  VN3016_NOT_A_NUMBER: { code: "VN3016", severity: "error" },
  VN3017_DECO_ARGUMENTS: { code: "VN3017", severity: "error" },
  VN3018_BAD_PATTERN: { code: "VN3018", severity: "error" },
  VN3019_MISSING_CASE: { code: "VN3019", severity: "error" },
  VN3020_UNREACHABLE_CASE: { code: "VN3020", severity: "error" },
  VN3021_NOT_A_PLACE: { code: "VN3021", severity: "error" },
  VN3022_RESERVED_CODE: { code: "VN3022", severity: "error" },
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
  VN6001_ASSERTION_FAILED: { code: "VN6001", severity: "error" },
  VN7001_ACTION_FAILED: { code: "VN7001", severity: "error" },
  VN7004_HOOK_FAILED: { code: "VN7004", severity: "error" },
} as const satisfies Record<string, CodeSpec>;
