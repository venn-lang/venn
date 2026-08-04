import type { Frame } from "../../expr/index.js";
import type { Step, Thunk } from "../compile.types.js";

/** What every compiled loop carries: the block it runs on each pass. */
export interface Passes {
  body: readonly Step[];
}

/** `forEach item in list { … }`, over a list the source already checked. */
export interface OverItems extends Passes {
  items: readonly unknown[];
  bind: (frame: Frame, item: unknown) => void;
}

/** `repeat n as i { … }`, counted from one. */
export interface OverCount extends Passes {
  times: number;
  bind: ((frame: Frame, at: number) => void) | undefined;
}

/** `loop { … }`, with the condition and the fresh cell a carried state needs. */
export interface OverPasses extends Passes {
  condition: Thunk | undefined;
  fresh: ((frame: Frame) => void) | undefined;
}
