/**
 * What kinds of value the language has, as one closed list.
 *
 * Closed on purpose. Six places used to answer "what is this" on their own and
 * disagreed, and the worst of them handed back whatever `kind` string an object
 * happened to carry, so `typeOf` could invent a type name the language does not
 * have. A value is one of these and nothing else.
 */
export type ValueKind =
  | "null"
  | "bool"
  | "number"
  | "string"
  | "list"
  | "map"
  | "fn"
  | "duration"
  | "size"
  | "percent"
  | "instant"
  | "regex"
  | "task"
  /**
   * A value a plugin handed over: a browser page, an open connection. It is a
   * host object whose published verbs are exactly what it answers to, which is
   * the one kind whose members the language does not decide.
   *
   * Inferred, never declared. What marks one is a prototype that names what
   * constructed it, so a class instance is a handle and so is anything built
   * from one; a plain object literal, or one behind nothing but plain data,
   * reads as a map. That is a real consequence and not a detail: every plugin
   * in this repo returns its handle as a plain object literal, `ServeHandle`
   * included, so `typeOf(http.serve {…})` answers `map` today and this kind
   * has no inhabitant in the standard library. Nothing breaks, because the
   * checker refuses a member read on the opaque type before a run can ask.
   */
  | "handle";
