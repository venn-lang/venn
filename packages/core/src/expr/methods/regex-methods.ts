import { buildProblem, CODES } from "../../codes/index.js";
import { ProblemError } from "../../problem/index.js";
import { nativeFn } from "../native.types.js";

/**
 * A compiled pattern, and what a program may do with one.
 *
 * Compiled once where it is written rather than on every comparison: a `~=`
 * inside a loop used to rebuild the same pattern on every pass, and a pattern
 * that does not compile could only be found by running the line.
 */
export interface Pattern {
  readonly kind: "regex";
  /** The pattern as written, which is what `.source` answers and what prints. */
  readonly source: string;
  readonly flags: string;
  /** The compiled form. Not reachable from the language: `.test` is. */
  readonly compiled: RegExp;
}

const NO_SPAN = { uri: "", offset: 0, length: 0, line: 1, column: 1 };

/** Whether this value is a compiled pattern. */
export function isPattern(value: unknown): value is Pattern {
  return typeof value === "object" && value !== null && (value as Pattern).kind === "regex";
}

/**
 * Compile a pattern, or say why it is not one.
 *
 * @param source The pattern text. A raw string is how one is written: `r"\\d+"`.
 * @param flags Regular expression flags. Empty by default; `(?i:…)` inside the
 * pattern is the other way to ask for one, and works per group.
 * @returns The compiled pattern.
 * @throws ProblemError VN3018 when the text does not compile.
 */
export function pattern(source: string, flags = ""): Pattern {
  return { kind: "regex", source, flags, compiled: compile(source, flags) };
}

function compile(source: string, flags: string): RegExp {
  try {
    return new RegExp(source, flags);
  } catch (error) {
    throw badPattern(source, error);
  }
}

function badPattern(source: string, error: unknown): ProblemError {
  const why =
    error instanceof Error ? error.message.replace(/^Invalid regular expression: /, "") : "";
  return new ProblemError(
    buildProblem({
      spec: CODES.VN3018_BAD_PATTERN,
      span: NO_SPAN,
      title: `This is not a pattern: ${source}. ${why}`.trim(),
    }),
  );
}

/**
 * What a pattern answers to.
 *
 * `match` gives the groups rather than a boolean, since the whole reason to
 * capture is to read what was captured; `test` is the boolean, and `~=` is the
 * operator spelling of the same question.
 */
export const REGEX_METHODS: Record<string, unknown> = {
  source: (value: Pattern) => value.source,
  flags: (value: Pattern) => value.flags,
  test: (value: Pattern) => nativeFn((args) => value.compiled.test(String(args[0] ?? ""))),
  match: (value: Pattern) => nativeFn((args) => groupsOf(value, String(args[0] ?? ""))),
};

/**
 * Every group of the first match, the whole match first, or an empty list.
 *
 * A list rather than null for no match, so `.match(s).len == 0` reads as "it did
 * not match" without a second shape to handle.
 */
function groupsOf(value: Pattern, subject: string): string[] {
  const found = value.compiled.exec(subject);
  return found ? [...found].map((group) => group ?? "") : [];
}
