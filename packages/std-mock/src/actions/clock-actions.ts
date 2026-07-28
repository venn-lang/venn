import { type ActionDefinition, type ActionInput, arg, Duration, defineAction } from "@venn/sdk";
import { t } from "@venn/types";
import { getMockState } from "../state/index.js";

/**
 * `mock.clock.freeze("2026-01-01T00:00:00Z")`: pin virtual time to an instant.
 *
 * The instant is only recorded in mock state. It does not drive the host clock,
 * so a verb that asks the host what time it is still gets the real answer.
 */
export const clockFreeze: ActionDefinition = defineAction({
  name: "clock.freeze",
  doc: "Freeze virtual time at the given instant (recorded in mock state only, for now).",
  args: [arg("at", t.union(t.string, t.number, t.instant), "The instant to hold time at.")],
  result: t.number,
  run: (_ctx, input) => freezeClock(input),
});

function freezeClock(input: ActionInput<unknown>): number {
  const instant = toInstant(input.args[0]);
  getMockState().frozenInstant = instant;
  return instant;
}

function toInstant(value: unknown): number {
  if (typeof value === "number") return value;
  const epochMs = instantValue(value);
  if (epochMs !== undefined) return epochMs;
  const ms = Date.parse(String(value));
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * `mock.clock.advance("1h")`: move the stored virtual time forward by a span.
 *
 * Advancing an unfrozen clock counts from the epoch, since there is no instant
 * to move from.
 */
export const clockAdvance: ActionDefinition = defineAction({
  name: "clock.advance",
  doc: 'Advance the frozen virtual time by a duration, e.g. mock.clock.advance("1h").',
  args: [arg("by", t.union(t.string, t.number, t.duration), "How far to move time forward.")],
  result: t.number,
  run: (_ctx, input) => advanceClock(input),
});

function advanceClock(input: ActionInput<unknown>): number {
  const state = getMockState();
  const next = (state.frozenInstant ?? 0) + durationMs(input);
  state.frozenInstant = next;
  return next;
}

function durationMs(input: ActionInput<unknown>): number {
  const params = (input.params ?? {}) as { by?: unknown };
  const given = input.args[0] ?? params.by;
  const ms = durationValue(given);
  if (ms !== undefined) return ms;
  const parsed = Duration.safeParse(given);
  return parsed.success ? parsed.data : 0;
}

/**
 * The number inside a unit value, when the argument is one.
 *
 * `1h` and `2026-07-23T12:00:00Z` reach an action as `{ kind, ms }` and
 * `{ kind, epochMs }`, the language's own literals rather than strings. Without
 * this unwrapping they parse to `NaN` and the clock silently sits at the epoch.
 */
function durationValue(value: unknown): number | undefined {
  const unit = value as { kind?: string; ms?: number } | null | undefined;
  return unit?.kind === "duration" ? (unit.ms ?? 0) : undefined;
}

function instantValue(value: unknown): number | undefined {
  const unit = value as { kind?: string; epochMs?: number } | null | undefined;
  return unit?.kind === "instant" ? (unit.epochMs ?? 0) : undefined;
}
