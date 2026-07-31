import { ClockPort } from "@venn-lang/contracts";
import { type ActionDefinition, arg, defineAction, optionalArg } from "@venn-lang/sdk";
import { type TypeSpec, t } from "@venn-lang/types";
import { formatParts, partsIn } from "../format/format-instant.js";

/** A moment, as the language holds one: the milliseconds and the text. */
function at(epochMs: number): unknown {
  return { kind: "instant", epochMs, iso: new Date(epochMs).toISOString() };
}

function epochOf(value: unknown): number {
  const held = value as { kind?: string; epochMs?: number } | undefined;
  return held?.kind === "instant" ? (held.epochMs ?? 0) : Number.NaN;
}

const number = (value: unknown, fallback = 0): number => {
  const found = Number(value ?? fallback);
  return Number.isFinite(found) ? found : fallback;
};

/** The shape `date.of` takes and `date.in` gives back. */
export const PARTS_TYPE: TypeSpec = t.record({
  year: t.number,
  month: t.number,
  day: t.number,
  hour: t.number,
  minute: t.number,
  second: t.number,
});

/**
 * The verbs of the `date` namespace: building a moment, writing one out, and
 * reading one where somebody stands.
 *
 * What a moment answers about itself is a member: `at.year`, `at.plus(2h)`,
 * `at.until(other)`. Here is what needs something a moment does not have, which
 * is the clock, a pattern, or a place on earth.
 */
export const dateActions: ActionDefinition[] = [
  defineAction({
    name: "now",
    doc: "The moment this run calls now, from the run's own clock rather than the machine's.",
    result: t.instant,
    run: (ctx) => at(ctx.port(ClockPort).now()),
  }),
  defineAction({
    name: "of",
    doc: "A moment from its parts, in UTC. Anything left out is the smallest it can be.",
    args: [arg("parts", PARTS_TYPE, "Year and month and day, and the time of day if it matters.")],
    result: t.instant,
    run: (_ctx, input) => at(fromParts(input.args[0])),
  }),
  defineAction({
    name: "parse",
    doc: "A moment from text. Null when the text is not one, which is the everyday case.",
    args: [arg("text", t.string, "ISO 8601, or anything the runtime reads as a date.")],
    result: t.union(t.instant, t.null),
    run: (_ctx, input) => parsed(String(input.args[0] ?? "")),
  }),
  defineAction({
    name: "format",
    doc: "Write a moment out by a pattern: YYYY-MM-DD HH:mm:ss, and the shorter spellings.",
    args: [
      arg("at", t.instant, "The moment."),
      arg("pattern", t.string, "What to write. Anything that is not a token stays as it is."),
      optionalArg("zone", t.string, "Where to read it, as `Europe/Lisbon`. UTC by default."),
    ],
    result: t.string,
    run: (_ctx, input) => written(input.args),
  }),
  defineAction({
    name: "in",
    doc: "The parts of a moment where somebody stands, which is the only place a date is a date.",
    args: [
      arg("at", t.instant, "The moment."),
      arg("zone", t.string, "An IANA name, as `America/Sao_Paulo`."),
    ],
    result: t.union(PARTS_TYPE, t.null),
    run: (_ctx, input) => partsIn(epochOf(input.args[0]), String(input.args[1] ?? "")) ?? null,
  }),
];

/** Months count from one here, as they do everywhere a date is written. */
function fromParts(value: unknown): number {
  const parts = (value ?? {}) as Record<string, unknown>;
  return Date.UTC(
    number(parts.year, 1970),
    number(parts.month, 1) - 1,
    number(parts.day, 1),
    number(parts.hour),
    number(parts.minute),
    number(parts.second),
  );
}

function parsed(text: string): unknown {
  const epochMs = Date.parse(text);
  return Number.isNaN(epochMs) ? null : at(epochMs);
}

function written(args: readonly unknown[]): string {
  const parts = partsIn(epochOf(args[0]), zoneOf(args[2]));
  if (!parts) throw new Error(`This is not a timezone: ${String(args[2])}.`);
  return formatParts(parts, String(args[1] ?? ""));
}

function zoneOf(value: unknown): string | undefined {
  const name = value === undefined || value === null ? "" : String(value);
  return name === "" ? undefined : name;
}
