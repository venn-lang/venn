import type { Port } from "../../port/index.js";
import type { Clock } from "./clock.types.js";

/**
 * The {@link Clock} contract. Implementations: `system-clock`, `virtual-clock`.
 *
 * `advance` and `setTime` are absent on purpose: they are how a test drives a
 * virtual clock, not something a caller of the port may reach for.
 *
 * Version 2 gave `sleep` its optional `AbortSignal`. The method list is
 * unchanged, so `assertPortShape` binds an implementation written against
 * version 1 without a word: it has the method, it just ignores the signal, and
 * every `wait` behind it becomes uninterruptible again. The version is what says
 * so, and the conformance suite is what catches it.
 */
export const ClockPort: Port<Clock> = {
  id: "venn.port.clock",
  version: 2,
  requires: ["clock"],
  methods: ["now", "sleep"],
};
