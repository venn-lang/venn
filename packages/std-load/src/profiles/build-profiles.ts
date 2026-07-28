import type {
  ConstantProfile,
  LoadProfile,
  RampProfile,
  SpikeProfile,
} from "./load-profile.types.js";

/**
 * Builds a ramp profile: a climb from `from` to `to` virtual users across
 * `over` milliseconds, then held at `to` for `hold` milliseconds.
 *
 * @returns the profile. Nothing is executed here.
 */
export function rampProfile(args: {
  from: number;
  to: number;
  over?: number;
  hold?: number;
}): RampProfile {
  return { kind: "ramp", from: args.from, to: args.to, over: args.over, hold: args.hold };
}

/** Builds a flat profile: `vus` virtual users held for `over` milliseconds. */
export function constantProfile(args: { vus: number; over?: number }): ConstantProfile {
  return { kind: "constant", vus: args.vus, over: args.over };
}

/** Builds a burst profile: one spike to `peak` virtual users, `at` ms into the run. */
export function spikeProfile(args: { peak: number; at?: number }): SpikeProfile {
  return { kind: "spike", peak: args.peak, at: args.at };
}

/**
 * The highest concurrency a profile calls for, whichever shape it is. This is
 * the number a runner sizes itself against.
 */
export function peakVus(profile: LoadProfile): number {
  if (profile.kind === "ramp") return profile.to;
  if (profile.kind === "constant") return profile.vus;
  return profile.peak;
}
