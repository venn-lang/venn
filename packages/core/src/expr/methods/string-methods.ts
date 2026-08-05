import { textIsNotANumber } from "../argument-refusal.js";
import { counted, countedOr } from "../counted-argument.js";
import type { Counted } from "../counted-argument.types.js";
import { type Method, nativeFn } from "../native.types.js";

const FROM: Counted = { verb: "slice", what: "position to start at", least: 0 };
const TO: Counted = { verb: "slice", what: "position to stop at", least: 0 };
const REPEAT: Counted = { verb: "repeat", what: "count", least: 0 };
const PAD_START: Counted = { verb: "padStart", what: "width", least: 0 };
const PAD_END: Counted = { verb: "padEnd", what: "width", least: 0 };

/**
 * Text read as a number, or a refusal.
 *
 * `Number(text)` was here and it answers `NaN` for a word, `0` for an empty
 * string and `Infinity` for the word "Infinity". None of the three is a number
 * anybody asked for, and all three survive every sum after them: this is the
 * first of the three steps that took `--top abc` to a report with no rows and
 * exit 0. Text that might not be a number is an ordinary thing to hold, so the
 * refusal names the spelling that handles it.
 */
function toNumber(text: string): number {
  const trimmed = text.trim();
  const value = trimmed === "" ? Number.NaN : Number(trimmed);
  if (!Number.isFinite(value)) throw textIsNotANumber(text);
  return value;
}

/**
 * Members of a string value. A no-argument transform is a property, read
 * without parentheses (`name.upper`); anything taking an argument is a method
 * (`name.split(",")`). `replace` replaces every occurrence.
 */
export const STRING_METHODS: Record<string, Method> = {
  len: (text: string) => text.length,
  upper: (text: string) => text.toUpperCase(),
  lower: (text: string) => text.toLowerCase(),
  trim: (text: string) => text.trim(),
  reverse: (text: string) => [...text].reverse().join(""),
  toNumber: (text: string) => toNumber(text),
  split: (text: string) => nativeFn((args) => text.split(String(args[0] ?? ""))),
  replace: (text: string) =>
    nativeFn((args) => text.split(String(args[0])).join(String(args[1] ?? ""))),
  contains: (text: string) => nativeFn((args) => text.includes(String(args[0]))),
  startsWith: (text: string) => nativeFn((args) => text.startsWith(String(args[0]))),
  endsWith: (text: string) => nativeFn((args) => text.endsWith(String(args[0]))),
  // Asking past the end is how a caller says "from here on", so the clamping
  // stays. A position before the start is refused: it meant "one from the end"
  // by accident of the host, and this language has no such spelling for text.
  slice: (text: string) =>
    nativeFn((args) => text.slice(counted(args[0], FROM), countedOr(args[1], text.length, TO))),
  repeat: (text: string) => nativeFn((args) => text.repeat(counted(args[0], REPEAT))),
  padStart: (text: string) =>
    nativeFn((args) => text.padStart(counted(args[0], PAD_START), String(args[1] ?? " "))),
  padEnd: (text: string) =>
    nativeFn((args) => text.padEnd(counted(args[0], PAD_END), String(args[1] ?? " "))),
  indexOf: (text: string) => nativeFn((args) => text.indexOf(String(args[0]))),
};
