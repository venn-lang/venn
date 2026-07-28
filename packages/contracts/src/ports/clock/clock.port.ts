import type { Port } from "../../port/index.js";
import type { Clock } from "./clock.types.js";

/**
 * The {@link Clock} contract. Implementations: `system-clock`, `virtual-clock`.
 *
 * `advance` and `setTime` are absent on purpose: they are how a test drives a
 * virtual clock, not something a caller of the port may reach for.
 */
export const ClockPort: Port<Clock> = {
  id: "venn.port.clock",
  version: 1,
  requires: ["clock"],
  methods: ["now", "sleep"],
};
