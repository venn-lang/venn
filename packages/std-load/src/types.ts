import { type TypeSpec, t } from "@venn-lang/types";

/**
 * The types `@venn-lang/load` publishes to the checker, under the `load` namespace:
 * the three profiles its builders return, the union `load.run` accepts, and the
 * metrics it yields. They mirror `profiles/load-profile.types.ts` and
 * `metrics/load-metrics.types.ts` field by field, dropping the `Load` and
 * `Profile` affixes the namespace already says: a flow reads `load.Ramp`.
 *
 * Durations are `number` here on purpose. The `Duration` schema accepts `"30s"`
 * or a plain millisecond count, not the language's own `duration` value, and
 * yields milliseconds. What a profile holds is therefore a count.
 */
export const loadTypeDefs: Readonly<Record<string, TypeSpec>> = {
  /** A ramp from `from` to `to` VUs over `over`, then held for `hold`. */
  Ramp: t.record(
    { kind: t.literal("ramp"), from: t.number, to: t.number, over: t.number, hold: t.number },
    { optional: ["over", "hold"] },
  ),
  /** A constant `vus` load sustained over `over`. */
  Constant: t.record(
    { kind: t.literal("constant"), vus: t.number, over: t.number },
    { optional: ["over"] },
  ),
  /** A single spike to `peak` VUs at `at` into the run. */
  Spike: t.record({ kind: t.literal("spike"), peak: t.number, at: t.number }, { optional: ["at"] }),
  /** Whatever a builder produced. This is what `load.run` takes. */
  Profile: t.union(t.ref("load.Ramp"), t.ref("load.Constant"), t.ref("load.Spike")),
  /** What a run yields. The invariant `p50 <= p95 <= p99` always holds. */
  Metrics: t.record({
    vus: t.number,
    rps: t.number,
    p50: t.number,
    p95: t.number,
    p99: t.number,
    errorRate: t.number,
  }),
};
