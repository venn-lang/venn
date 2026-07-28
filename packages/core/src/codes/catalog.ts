import type { CodeSpec } from "./code.types.js";

/**
 * Every VNxxxx the kernel itself can raise. Codes are stable, googlable, and
 * documented; families follow the leading digit (1 lex/syntax … 8 timeout).
 */
export const CODES = {
  VN1001_LEX: { code: "VN1001", severity: "error" },
  VN1002_PARSE: { code: "VN1002", severity: "error" },
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
  VN3001_UNKNOWN_OPTION: { code: "VN3001", severity: "error" },
  VN3010_TYPE_MISMATCH: { code: "VN3010", severity: "error" },
  VN3012_UNIT_MISMATCH: { code: "VN3012", severity: "error" },
  VN3013_NOT_CALLABLE: { code: "VN3013", severity: "error" },
  VN3014_STILL_WAITING: { code: "VN3014", severity: "error" },
  VN3015_NOT_A_LIST: { code: "VN3015", severity: "error" },
  VN3016_NOT_A_NUMBER: { code: "VN3016", severity: "error" },
  VN3017_DECO_ARGUMENTS: { code: "VN3017", severity: "error" },
  VN5001_REMOVED_KEYWORD: { code: "VN5001", severity: "error" },
  VN6001_ASSERTION_FAILED: { code: "VN6001", severity: "error" },
  VN7001_ACTION_FAILED: { code: "VN7001", severity: "error" },
  VN7004_HOOK_FAILED: { code: "VN7004", severity: "error" },
  VN8002_LOOP_LIMIT: { code: "VN8002", severity: "error" },
} as const satisfies Record<string, CodeSpec>;
