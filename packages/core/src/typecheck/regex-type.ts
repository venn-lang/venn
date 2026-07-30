import { BOOL, fn, list, opaque, STRING, type Type } from "./type.types.js";

/**
 * `regex`, one of the kernel's own types.
 *
 * Opaque rather than a record: how a pattern is held is none of a program's
 * business, and the four members below are the whole of what one offers. A
 * pattern is made with `regex(r"…")` and read with `.test`, `.match`, `.source`
 * and `.flags`.
 *
 * The alternative was leaving a pattern as text, which is what it was: then a
 * binding holding one carries a string's members, a `~=` in a loop recompiles on
 * every pass, and a pattern that does not compile can only be found by running
 * the line.
 */
export const REGEX_TYPE: Type = opaque(
  "regex",
  new Map<string, Type>([
    ["source", STRING],
    ["flags", STRING],
    ["test", fn([STRING], BOOL)],
    // The whole match first, then each group. Empty when it did not match, so
    // `.match(s).len == 0` is the question without a second shape to handle.
    ["match", fn([STRING], list(STRING))],
  ]),
);
