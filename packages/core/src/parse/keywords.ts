/**
 * Every word the grammar reserves, and nothing else.
 *
 * One list, because there were six and three had drifted: a word removed from
 * the language stayed in three of them and the word that replaced it reached
 * none. A test derives the set from the generated grammar and asks this to be
 * exactly it, so neither a word added to the language nor one taken out of it
 * can be forgotten here.
 */
export const KEYWORDS: ReadonlySet<string> = new Set([
  "afterEach",
  "all",
  "as",
  "beforeEach",
  "break",
  "capture",
  "catch",
  "config",
  "const",
  "continue",
  "deco",
  "defer",
  "else",
  "expect",
  "false",
  "finally",
  "flow",
  "fn",
  "forEach",
  "fragment",
  "from",
  "group",
  "if",
  "import",
  "in",
  "let",
  "loop",
  "match",
  "matrix",
  "module",
  "namespace",
  "not",
  "null",
  "on",
  "parallel",
  "pub",
  "race",
  "repeat",
  "return",
  "run",
  "setup",
  "soft",
  "step",
  "teardown",
  "true",
  "try",
  "type",
]);

/** The words a value may hold, so one after an operator is still part of it. */
const IN_A_VALUE: ReadonlySet<string> = new Set([
  "catch",
  "else",
  "false",
  "fn",
  "if",
  "in",
  "match",
  "not",
  "null",
  "true",
  "try",
]);

/**
 * The words that begin a clause of their own, so an argument stops before one.
 *
 * `import a + b from "x"` was read as a call to `import` taking everything to
 * the end of the line, `from` clause and all, and offered back as the fix.
 */
export const CUTS_A_VALUE: ReadonlySet<string> = new Set(
  [...KEYWORDS].filter((word) => !IN_A_VALUE.has(word)),
);
