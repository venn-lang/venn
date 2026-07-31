/**
 * Writing a moment out by a pattern, and reading its parts where somebody stands.
 *
 * The parts come from `Intl`, which is where a runtime keeps the world's
 * timezones. Doing the arithmetic by hand would mean shipping a copy of that
 * table and watching it go out of date.
 */

/** The parts of a moment, as they read in one place on earth. */
export interface Parts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

const NUMERIC = "2-digit" as const;

/**
 * The parts of a moment as they read in a timezone.
 *
 * @param epochMs The moment.
 * @param zone An IANA name such as `Europe/Lisbon`. UTC when absent.
 * @returns The parts, or nothing when the runtime does not know that zone.
 */
export function partsIn(epochMs: number, zone?: string): Parts | undefined {
  try {
    const format = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone ?? "UTC",
      year: "numeric",
      month: NUMERIC,
      day: NUMERIC,
      hour: NUMERIC,
      minute: NUMERIC,
      second: NUMERIC,
      hour12: false,
    });
    return read(format.formatToParts(new Date(epochMs)));
  } catch {
    return undefined;
  }
}

function read(parts: readonly Intl.DateTimeFormatPart[]): Parts {
  const found = new Map(parts.map((part) => [part.type, Number(part.value)]));
  return {
    year: found.get("year") ?? 0,
    month: found.get("month") ?? 0,
    day: found.get("day") ?? 0,
    // Midnight comes back as 24 in some runtimes, which is the same hour by
    // another name and the wrong one to print.
    hour: (found.get("hour") ?? 0) % 24,
    minute: found.get("minute") ?? 0,
    second: found.get("second") ?? 0,
  };
}

/** Every token a pattern may hold, longest first so `YYYY` wins over `YY`. */
const TOKENS: readonly [string, (parts: Parts) => string][] = [
  ["YYYY", (parts) => String(parts.year).padStart(4, "0")],
  ["YY", (parts) => String(parts.year % 100).padStart(2, "0")],
  ["MM", (parts) => pad(parts.month)],
  ["DD", (parts) => pad(parts.day)],
  ["HH", (parts) => pad(parts.hour)],
  ["mm", (parts) => pad(parts.minute)],
  ["ss", (parts) => pad(parts.second)],
  ["M", (parts) => String(parts.month)],
  ["D", (parts) => String(parts.day)],
  ["H", (parts) => String(parts.hour)],
];

/**
 * Write a moment out by a pattern.
 *
 * @param parts The moment's parts, already read in whatever zone was asked for.
 * @param pattern `YYYY-MM-DD HH:mm:ss` and the shorter spellings of each.
 * @returns The text, with anything that is not a token left as it was written.
 */
export function formatParts(parts: Parts, pattern: string): string {
  let out = "";
  let at = 0;
  while (at < pattern.length) {
    const token = TOKENS.find((one) => pattern.startsWith(one[0], at));
    if (!token) {
      out += pattern[at];
      at += 1;
    } else {
      out += token[1](parts);
      at += token[0].length;
    }
  }
  return out;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
