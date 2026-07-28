/** A ramp from `from` to `to` VUs over `over`, then held for `hold` (ms). */
export interface RampProfile {
  kind: "ramp";
  from: number;
  to: number;
  over?: number;
  hold?: number;
}

/** A constant `vus` load sustained over `over` (ms). */
export interface ConstantProfile {
  kind: "constant";
  vus: number;
  over?: number;
}

/** A single spike to `peak` VUs at `at` (ms into the run). */
export interface SpikeProfile {
  kind: "spike";
  peak: number;
  at?: number;
}

/** Whatever a builder produced. `kind` tells the runner which shape it holds. */
export type LoadProfile = RampProfile | ConstantProfile | SpikeProfile;
