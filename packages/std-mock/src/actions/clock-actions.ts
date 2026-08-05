import {
  type ActionDefinition,
  type ActionInput,
  arg,
  Duration,
  defineAction,
  unitBase,
} from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
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
  const epochMs = unitBase(value, "instant");
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

/**
 * How far to move, read from the one place the verb declares it.
 *
 * `Duration` is the whole answer now that it takes the language's own `1h`
 * literal as well as `"1h"` and a millisecond count. This used to unwrap the
 * literal itself, which is why `mock.clock.advance(1h)` was the one call of its
 * kind in the repository that worked.
 *
 * It used to fall back to an option named `by` that no `params` schema ever
 * declared, so `mock.clock.advance { by: "1h" }` worked when its result was
 * bound and was VN5007 when it was not: two answers to one call.
 */
function durationMs(input: ActionInput<unknown>): number {
  const parsed = Duration.safeParse(input.args[0]);
  return parsed.success ? parsed.data : 0;
}
