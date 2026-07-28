import { optionalArg } from "@venn/sdk";
import { t } from "@venn/types";
import type { Rng } from "../rng/index.js";
import type { FakerSpec } from "./faker.types.js";
import { intBetween, numArg, pad, pick } from "./primitives.js";

/**
 * The instant every generated date is measured from.
 *
 * Dates hang off a fixed anchor rather than the wall clock: `Date.now()` would
 * give a different answer on every run and break the seeded replay guarantee.
 */
export const ANCHOR: number = Date.UTC(2025, 0, 1);

const DAY = 86_400_000;
const YEAR = 365 * DAY;

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function offsetFrom(args: { rng: Rng; min: number; max: number }): number {
  return ANCHOR + intBetween({ min: args.min, max: args.max, rng: args.rng });
}

/** `YYYY-MM-DD` within five years either side of the anchor. */
function isoDate(rng: Rng): string {
  const at = offsetFrom({ rng, min: -5 * YEAR, max: 5 * YEAR });
  return new Date(at).toISOString().slice(0, 10);
}

function isoDateTime(rng: Rng): string {
  return new Date(offsetFrom({ rng, min: -5 * YEAR, max: 5 * YEAR })).toISOString();
}

function pastDate(rng: Rng): string {
  return new Date(offsetFrom({ rng, min: -5 * YEAR, max: -DAY })).toISOString();
}

function futureDate(rng: Rng): string {
  return new Date(offsetFrom({ rng, min: DAY, max: 5 * YEAR })).toISOString();
}

/** `HH:MM:SS` on a 24-hour clock. */
function time(rng: Rng): string {
  const part = (max: number): string => pad(intBetween({ min: 0, max, rng }), 2);
  return `${part(23)}:${part(59)}:${part(59)}`;
}

/** Seconds since the epoch, the unit `exp` and `iat` claims use. */
function timestamp(rng: Rng): number {
  return Math.floor(offsetFrom({ rng, min: -5 * YEAR, max: 5 * YEAR }) / 1000);
}

export const datetimeSpecs: readonly FakerSpec[] = [
  { name: "date", doc: "A date as `YYYY-MM-DD`.", result: t.string, make: isoDate },
  { name: "dateTime", doc: "An ISO 8601 instant.", result: t.string, make: isoDateTime },
  {
    name: "pastDate",
    doc: "An ISO 8601 instant before the anchor.",
    result: t.string,
    make: pastDate,
  },
  {
    name: "futureDate",
    doc: "An ISO 8601 instant after the anchor.",
    result: t.string,
    make: futureDate,
  },
  { name: "time", doc: "A time of day as `HH:MM:SS`.", result: t.string, make: time },
  { name: "timestamp", doc: "Seconds since the Unix epoch.", result: t.number, make: timestamp },
  {
    name: "weekday",
    doc: "A day of the week.",
    result: t.string,
    make: (rng) => pick(WEEKDAYS, rng),
  },
  { name: "month", doc: "A month name.", result: t.string, make: (rng) => pick(MONTHS, rng) },
  {
    name: "year",
    doc: "A year. `faker.year(2000, 2030)` bounds it.",
    result: t.number,
    args: [
      optionalArg("from", t.number, "The earliest year, included."),
      optionalArg("to", t.number, "The latest year, included."),
    ],
    make: (rng, args) =>
      intBetween({ min: numArg(args, 0, 1980), max: numArg(args, 1, 2030), rng }),
  },
];
