import { type Method, nativeFn } from "../native.types.js";

/** Methods on a number. Rounding and clamping without reaching for a namespace. */
export const NUMBER_METHODS: Record<string, Method> = {
  abs: (value: number) => Math.abs(value),
  floor: (value: number) => Math.floor(value),
  ceil: (value: number) => Math.ceil(value),
  sign: (value: number) => Math.sign(value),
  sqrt: (value: number) => Math.sqrt(value),
  isEven: (value: number) => value % 2 === 0,
  isOdd: (value: number) => Math.abs(value % 2) === 1,
  round: (value: number) => nativeFn((args) => roundTo(value, Number(args[0] ?? 0))),
  toFixed: (value: number) => nativeFn((args) => value.toFixed(places(args[0]))),
  clamp: (value: number) =>
    nativeFn((args) => Math.min(Math.max(value, Number(args[0])), Number(args[1]))),
  pow: (value: number) => nativeFn((args) => value ** Number(args[0])),
  times: (value: number) => Array.from({ length: Math.max(0, Math.trunc(value)) }, (_x, i) => i),
  toString: (value: number) => String(value),
};

function roundTo(value: number, decimals: number): number {
  const scale = 10 ** places(decimals);
  return Math.round(value * scale) / scale;
}

function places(value: unknown): number {
  const parsed = Math.trunc(Number(value ?? 0));
  return Number.isNaN(parsed) ? 0 : Math.min(20, Math.max(0, parsed));
}
