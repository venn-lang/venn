/**
 * Unit-typed values.
 *
 * Each holds a canonical base unit (milliseconds, bytes, a ratio in 0..1, epoch
 * milliseconds), so arithmetic never converts and only display does. The `kind`
 * field is the brand that keeps a unit from reading as an ordinary map.
 */

/** Which unit a value carries. */
export type UnitKind = "duration" | "size" | "percent";

/** A length of time, held in milliseconds. */
export interface Duration {
  readonly kind: "duration";
  readonly ms: number;
}

/** A quantity of data, held in bytes. */
export interface Size {
  readonly kind: "size";
  readonly bytes: number;
}

/** A proportion, held as a ratio in 0..1 rather than as 0..100. */
export interface Percent {
  readonly kind: "percent";
  readonly ratio: number;
}

/** A point in time. The source ISO text is kept so printing it back is exact. */
export interface Instant {
  readonly kind: "instant";
  readonly epochMs: number;
  readonly iso: string;
}

/** Any value carrying a unit. */
export type UnitValue = Duration | Size | Percent;
