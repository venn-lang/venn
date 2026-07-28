import { type Method, nativeFn } from "../native.types.js";

function end(value: unknown): number | undefined {
  return value === undefined ? undefined : Number(value);
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
  toNumber: (text: string) => Number(text),
  split: (text: string) => nativeFn((args) => text.split(String(args[0] ?? ""))),
  replace: (text: string) =>
    nativeFn((args) => text.split(String(args[0])).join(String(args[1] ?? ""))),
  contains: (text: string) => nativeFn((args) => text.includes(String(args[0]))),
  startsWith: (text: string) => nativeFn((args) => text.startsWith(String(args[0]))),
  endsWith: (text: string) => nativeFn((args) => text.endsWith(String(args[0]))),
  slice: (text: string) => nativeFn((args) => text.slice(Number(args[0] ?? 0), end(args[1]))),
  repeat: (text: string) => nativeFn((args) => text.repeat(Math.max(0, Number(args[0] ?? 0)))),
  padStart: (text: string) =>
    nativeFn((args) => text.padStart(Number(args[0] ?? 0), String(args[1] ?? " "))),
  padEnd: (text: string) =>
    nativeFn((args) => text.padEnd(Number(args[0] ?? 0), String(args[1] ?? " "))),
  indexOf: (text: string) => nativeFn((args) => text.indexOf(String(args[0]))),
};
