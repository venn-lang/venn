import type { Duration, Instant } from "../../units/index.js";
import { nativeFn } from "../native.types.js";

/** A moment, rebuilt from milliseconds since the epoch, ISO text and all. */
function at(epochMs: number): Instant {
  return { kind: "instant", epochMs, iso: new Date(epochMs).toISOString() };
}

/** How long, in milliseconds, whatever was handed over says it is. */
function millis(value: unknown): number {
  const held = value as Duration | undefined;
  return held?.kind === "duration" ? held.ms : Number(value ?? 0);
}

function epochOf(value: unknown): number {
  const held = value as Instant | undefined;
  return held?.kind === "instant" ? held.epochMs : Number.NaN;
}

/** A duration, which is what the language calls the distance between two moments. */
function lasting(ms: number): Duration {
  return { kind: "duration", ms };
}

/** What the parts of a moment are called, in the order a date is written. */
const PARTS = ["year", "month", "day", "hour", "minute", "second"] as const;

/**
 * What a moment answers about itself, read in UTC.
 *
 * A timezone is a question about where somebody is, which a moment does not
 * know: `date.in(t, "Europe/Lisbon")` is where that is asked. What is here is
 * true wherever it is read from.
 */
export const INSTANT_METHODS: Record<string, unknown> = {
  iso: (value: Instant) => value.iso,
  epochMs: (value: Instant) => value.epochMs,
  ...Object.fromEntries(PARTS.map((part) => [part, (value: Instant) => partOf(value, part)])),
  /** 1 is Monday, as everywhere that counts days rather than naming them. */
  weekday: (value: Instant) => new Date(value.epochMs).getUTCDay() || 7,
  /** The day on its own, which is what a report groups by. */
  date: (value: Instant) => value.iso.slice(0, 10),
  time: (value: Instant) => value.iso.slice(11, 19),
  plus: (value: Instant) => nativeFn((args) => at(value.epochMs + millis(args[0]))),
  minus: (value: Instant) => nativeFn((args) => at(value.epochMs - millis(args[0]))),
  /**
   * How long from here to there. Negative when the other moment is behind, so
   * `a.until(b)` and `b.until(a)` disagree the way subtraction does.
   */
  until: (value: Instant) => nativeFn((args) => lasting(epochOf(args[0]) - value.epochMs)),
  isBefore: (value: Instant) => nativeFn((args) => value.epochMs < epochOf(args[0])),
  isAfter: (value: Instant) => nativeFn((args) => value.epochMs > epochOf(args[0])),
};

function partOf(value: Instant, part: (typeof PARTS)[number]): number {
  const held = new Date(value.epochMs);
  if (part === "year") return held.getUTCFullYear();
  if (part === "month") return held.getUTCMonth() + 1;
  if (part === "day") return held.getUTCDate();
  if (part === "hour") return held.getUTCHours();
  return part === "minute" ? held.getUTCMinutes() : held.getUTCSeconds();
}
