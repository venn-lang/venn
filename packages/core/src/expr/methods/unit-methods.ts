import type { Duration, Percent, Size } from "../../units/index.js";
import { type Method, nativeFn } from "../native.types.js";

/**
 * Reading a unit back as a plain number, in whichever unit you want it.
 *
 * A `duration` knows it is a duration; what it does not know is whether you
 * want to print milliseconds or minutes. These are the way across, and they all
 * land on `number`, the unit having served its purpose by then.
 */
export const DURATION_METHODS: Record<string, Method> = {
  ms: (value: Duration) => value.ms,
  seconds: (value: Duration) => value.ms / 1000,
  minutes: (value: Duration) => value.ms / 60000,
  hours: (value: Duration) => value.ms / 3600000,
};

export const SIZE_METHODS: Record<string, Method> = {
  bytes: (value: Size) => value.bytes,
  kb: (value: Size) => value.bytes / 1024,
  mb: (value: Size) => value.bytes / 1048576,
  gb: (value: Size) => value.bytes / 1073741824,
};

export const PERCENT_METHODS: Record<string, Method> = {
  ratio: (value: Percent) => value.ratio,
  percent: (value: Percent) => value.ratio * 100,
  // `12%.of(50)` is 6: the share of something, which is what a percent is for.
  of: (value: Percent) => nativeFn((args) => Number(args[0]) * value.ratio),
};

/**
 * Reading a plain number *as* a unit: the way back.
 *
 * Symmetric with the tables above. `2mb.kb` writes a size out as 2048 and
 * `2048.toKb` reads 2048 back as that size, so for every `X` a unit answers to,
 * a number answers to `toX`.
 */
export const NUMBER_TO_UNIT: Record<string, Method> = {
  toMs: (value: number) => duration(value),
  toSeconds: (value: number) => duration(value * 1000),
  toMinutes: (value: number) => duration(value * 60000),
  toHours: (value: number) => duration(value * 3600000),
  toBytes: (value: number) => size(value),
  toKb: (value: number) => size(value * 1024),
  toMb: (value: number) => size(value * 1048576),
  toGb: (value: number) => size(value * 1073741824),
  toRatio: (value: number) => percent(value),
  toPercent: (value: number) => percent(value / 100),
};

const duration = (ms: number): Duration => ({ kind: "duration", ms });
const size = (bytes: number): Size => ({ kind: "size", bytes });
const percent = (ratio: number): Percent => ({ kind: "percent", ratio });
